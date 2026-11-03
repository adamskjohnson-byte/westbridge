<?php

namespace Database\Factories;

use App\Enums\TransactionCategory;
use App\Enums\TransactionDirection;
use App\Models\Account;
use App\Models\Transaction;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Transaction> */
class TransactionFactory extends Factory
{
    protected $model = Transaction::class;

    public function definition(): array
    {
        return [
            'account_id' => Account::factory(),
            'direction' => fake()->randomElement(TransactionDirection::cases()),
            'amount_cents' => fake()->numberBetween(1, 150000),
            'balance_after_cents' => fake()->numberBetween(1, 500000),
            'category' => fake()->randomElement(TransactionCategory::cases()),
            'description' => fake()->sentence(5),
            'counterparty_name' => fake()->optional()->company(),
            'reference' => (string) Str::ulid(),
            'posted_at' => fake()->dateTimeBetween('-90 days', 'now'),
        ];
    }
}
