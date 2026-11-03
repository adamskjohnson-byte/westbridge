<?php

namespace Database\Factories;

use App\Enums\TransferStatus;
use App\Models\Account;
use App\Models\Transfer;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Transfer> */
class TransferFactory extends Factory
{
    protected $model = Transfer::class;

    public function definition(): array
    {
        return [
            'initiated_by_user_id' => User::factory(),
            'from_account_id' => Account::factory(),
            'to_account_id' => Account::factory(),
            'amount_cents' => fake()->numberBetween(100, 250000),
            'currency' => 'USD',
            'memo' => fake()->optional()->sentence(4),
            'status' => TransferStatus::Pending,
            'idempotency_key' => fake()->optional()->uuid(),
        ];
    }
}
