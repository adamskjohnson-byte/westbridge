<?php

namespace Database\Factories;

use App\Enums\CardStatus;
use App\Enums\CardType;
use App\Models\Account;
use App\Models\Card;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Card> */
class CardFactory extends Factory
{
    protected $model = Card::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'account_id' => Account::factory(),
            'type' => CardType::Debit,
            'last4' => fake()->numerify('####'),
            'expiry_month' => fake()->numberBetween(1, 12),
            'expiry_year' => (int) now()->addYears(fake()->numberBetween(1, 5))->format('Y'),
            'nickname' => fake()->optional()->randomElement(['Everyday card', 'Travel card']),
            'status' => CardStatus::Active,
            'daily_limit_cents' => fake()->numberBetween(10000, 500000),
        ];
    }
}
