<?php

namespace Database\Factories;

use App\Enums\AccountStatus;
use App\Enums\AccountType;
use App\Models\Account;
use App\Models\User;
use App\Services\AccountNumberGenerator;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Account> */
class AccountFactory extends Factory
{
    protected $model = Account::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'account_number' => app(AccountNumberGenerator::class)->generate(),
            'type' => fake()->randomElement(AccountType::cases()),
            'nickname' => fake()->optional()->words(2, true),
            'currency' => 'USD',
            'status' => AccountStatus::Active,
            'opened_at' => now()->subDays(fake()->numberBetween(1, 900)),
        ];
    }
}
