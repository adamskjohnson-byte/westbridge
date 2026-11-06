<?php

namespace App\Services;

use App\Models\Account;
use App\Models\User;
use App\Notifications\TypedNotification;
use Illuminate\Support\Facades\DB;

class NotificationService
{
    public function sendAfterCommit(User $user, string $type, array $params = []): void
    {
        DB::afterCommit(static fn () => $user->notify(new TypedNotification($type, $params)));
    }

    public function checkLowBalance(Account $account, bool $debit = true): void
    {
        $account->refresh();
        $settings = $account->user->settings;
        $threshold = $settings?->low_balance_threshold_cents;
        if ($threshold === null) {
            return;
        }
        $below = (int) $account->balance_cents < $threshold;
        if ($debit && $below && ! $account->low_balance_notified) {
            $account->low_balance_notified = true;
            $account->save();
            $this->sendAfterCommit($account->user, 'low_balance', [
                'account_type' => $account->type->value,
                'balance_cents' => (int) $account->balance_cents,
                'threshold_cents' => $threshold,
            ]);
        } elseif (! $below && $account->low_balance_notified) {
            $account->low_balance_notified = false;
            $account->save();
        }
    }
}