<?php

namespace App\Services;

use App\Models\Account;

class AccountNumberGenerator
{
    public function generate(): string
    {
        do {
            $number = (string) random_int(1, 9);

            for ($digit = 1; $digit < 10; $digit++) {
                $number .= (string) random_int(0, 9);
            }
        } while (Account::query()->where('account_number', $number)->exists());

        return $number;
    }
}
