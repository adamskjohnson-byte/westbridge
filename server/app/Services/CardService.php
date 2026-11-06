<?php

namespace App\Services;

use App\Enums\AccountStatus;
use App\Enums\CardStatus;
use App\Enums\CardType;
use App\Exceptions\Bank\CardOperationException;
use App\Models\Account;
use App\Models\AuditLog;
use App\Models\Card;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CardService
{
    public function index(User $user, bool $includeCancelled = false)
    {
        return Card::query()->with('account')->where('user_id', $user->getKey())
            ->when(! $includeCancelled, fn ($query) => $query->where('status', '!=', CardStatus::Cancelled->value))
            ->orderBy('created_at')->get();
    }

    public function issue(User $user, int $accountId, ?string $nickname): Card
    {
        return DB::transaction(function () use ($user, $accountId, $nickname): Card {
            User::query()->whereKey($user->getKey())->lockForUpdate()->firstOrFail();
            $account = Account::query()->whereKey($accountId)->lockForUpdate()->first();
            if ($account === null || (int) $account->user_id !== (int) $user->getKey()) {
                abort(404);
            }
            if ($account->status !== AccountStatus::Active) {
                throw ValidationException::withMessages(['account_id' => ['validation.account_inactive']]);
            }
            $activeCount = Card::query()->where('user_id', $user->getKey())->whereIn('status', [CardStatus::Active->value, CardStatus::Frozen->value])->count();
            if ($activeCount >= (int) config('bank.max_active_cards', 3)) {
                throw ValidationException::withMessages(['card' => ['validation.card_limit_reached']]);
            }
            $card = Card::create([
                'user_id' => $user->getKey(), 'account_id' => $account->getKey(), 'type' => CardType::Debit,
                'last4' => (string) random_int(0, 9999), 'expiry_month' => (int) now('UTC')->format('n'),
                'expiry_year' => (int) now('UTC')->addYears(4)->format('Y'), 'nickname' => $nickname,
                'status' => CardStatus::Active, 'daily_limit_cents' => (int) config('bank.card_default_daily_limit_cents', 100000),
            ]);
            $card->last4 = str_pad($card->last4, 4, '0', STR_PAD_LEFT);
            $card->save();
            $this->audit($user, $card, 'card.issued');
            app(NotificationService::class)->sendAfterCommit($user, 'card_issued', ['last4' => $card->last4]);

            return $card->load('account');
        }, 3);
    }

    public function update(User $user, Card $card, array $data): Card
    {
        return DB::transaction(function () use ($user, $card, $data): Card {
            $card = $this->owned($user, Card::query()->whereKey($card->getKey())->lockForUpdate()->firstOrFail());
            if ($card->status === CardStatus::Cancelled) {
                throw new CardOperationException('card_cancelled');
            }
            $card->fill($data);
            $card->save();
            $this->audit($user, $card, 'card.updated', array_intersect_key($data, array_flip(['nickname', 'daily_limit_cents'])));

            return $card->load('account');
        }, 3);
    }

    public function transition(User $user, Card $card, string $action): Card
    {
        return DB::transaction(function () use ($user, $card, $action): Card {
            $card = $this->owned($user, Card::query()->whereKey($card->getKey())->lockForUpdate()->firstOrFail());
            if ($card->status === CardStatus::Cancelled) {
                throw new CardOperationException('card_cancelled');
            }
            if ($action === 'cancel') {
                $card->status = CardStatus::Cancelled;
            } elseif ($action === 'freeze' && $card->status !== CardStatus::Frozen) {
                $card->status = CardStatus::Frozen;
            } elseif ($action === 'unfreeze' && $card->status !== CardStatus::Active) {
                $card->status = CardStatus::Active;
            }
            if ($card->isDirty()) {
                $card->save();
                $auditAction = match ($action) {
                    'freeze' => 'card.frozen',
                    'unfreeze' => 'card.unfrozen',
                    default => 'card.cancelled',
                };
                $this->audit($user, $card, $auditAction);
                $type = match ($action) {
                    'freeze' => 'card_frozen',
                    'unfreeze' => 'card_unfrozen',
                    default => 'card_cancelled',
                };
                app(NotificationService::class)->sendAfterCommit($user, $type, ['last4' => $card->last4]);
            }

            return $card->load('account');
        }, 3);
    }

    public function owned(User $user, Card $card): Card
    {
        if ((int) $card->user_id !== (int) $user->getKey()) {
            abort(404);
        }

        return $card;
    }

    private function audit(User $user, Card $card, string $action, array $metadata = []): void
    {
        AuditLog::create([
            'user_id' => $user->getKey(), 'action' => $action, 'entity_type' => 'card',
            'entity_id' => (string) $card->getKey(), 'metadata' => $metadata, 'created_at' => now('UTC'),
        ]);
    }
}