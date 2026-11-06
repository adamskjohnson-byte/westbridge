<?php

namespace App\Services;

use App\Enums\AccountStatus;
use App\Exceptions\Bank\RecipientNotFoundException;
use App\Models\Account;
use App\Models\AuditLog;
use App\Models\Beneficiary;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BeneficiaryService
{
    public function list(User $user)
    {
        return $user->beneficiaries()->orderByDesc('created_at')->orderByDesc('id')->get();
    }

    public function lookup(User $user, string $accountNumber, ?string $ip = null, ?string $userAgent = null): array
    {
        $account = Account::query()
            ->with('user')
            ->where('account_number', $accountNumber)
            ->where('status', AccountStatus::Active->value)
            ->first();

        AuditLog::create([
            'user_id' => $user->getKey(),
            'action' => 'recipient_lookup',
            'entity_type' => 'account',
            'entity_id' => $account === null ? null : (string) $account->getKey(),
            'ip_address' => $ip,
            'user_agent' => $userAgent,
            'metadata' => ['account_number_hash' => hash('sha256', $accountNumber)],
            'created_at' => now(),
        ]);

        if ($account === null || (int) $account->user_id === (int) $user->getKey()) {
            throw new RecipientNotFoundException;
        }

        return [
            'account_type' => $account->type->value,
            'holder_masked' => self::maskHolder($account->user->first_name, $account->user->last_name),
            'currency' => $account->currency,
        ];
    }

    public function create(User $user, string $accountNumber, ?string $nickname): Beneficiary
    {
        return DB::transaction(function () use ($user, $accountNumber, $nickname): Beneficiary {
            $lockedUser = User::query()->whereKey($user->getKey())->lockForUpdate()->firstOrFail();
            $account = Account::query()->with('user')
                ->where('account_number', $accountNumber)
                ->where('status', AccountStatus::Active->value)
                ->first();

            if ($account === null) {
                throw ValidationException::withMessages(['account_number' => ['validation.recipient_not_found']]);
            }
            if ((int) $account->user_id === (int) $lockedUser->getKey()) {
                throw ValidationException::withMessages(['account_number' => ['validation.beneficiary_self']]);
            }
            if ($lockedUser->beneficiaries()->where('account_number', $accountNumber)->exists()) {
                throw ValidationException::withMessages(['account_number' => ['validation.beneficiary_exists']]);
            }
            if ($lockedUser->beneficiaries()->count() >= 50) {
                throw ValidationException::withMessages(['account_number' => ['validation.beneficiary_limit']]);
            }

            $beneficiary = Beneficiary::create([
                'user_id' => $lockedUser->getKey(),
                'name' => trim($account->user->first_name.' '.$account->user->last_name),
                'account_number' => $accountNumber,
                'nickname' => $nickname === null ? null : trim($nickname),
            ]);
            AuditLog::create([
                'user_id' => $lockedUser->getKey(),
                'action' => 'beneficiary.created',
                'entity_type' => 'beneficiary',
                'entity_id' => (string) $beneficiary->getKey(),
                'metadata' => ['account_number_hash' => hash('sha256', $accountNumber)],
                'created_at' => now(),
            ]);

            return $beneficiary;
        }, 3);
    }

    public function delete(User $user, int $beneficiaryId): void
    {
        DB::transaction(function () use ($user, $beneficiaryId): void {
            $beneficiary = $user->beneficiaries()->whereKey($beneficiaryId)->firstOrFail();
            AuditLog::create([
                'user_id' => $user->getKey(),
                'action' => 'beneficiary.deleted',
                'entity_type' => 'beneficiary',
                'entity_id' => (string) $beneficiary->getKey(),
                'metadata' => ['account_number_hash' => hash('sha256', $beneficiary->account_number)],
                'created_at' => now(),
            ]);
            $beneficiary->delete();
        }, 3);
    }

    public static function maskAccountNumber(string $number): string
    {
        return '•••• '.substr($number, -4);
    }

    public static function maskHolder(string $firstName, string $lastName): string
    {
        $first = trim($firstName);
        $last = trim($lastName);

        return ($first === '' ? '*' : mb_substr($first, 0, 1)).'*** '.($last === '' ? '*' : mb_substr($last, 0, 1)).'***';
    }
}
