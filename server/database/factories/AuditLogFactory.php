<?php

namespace Database\Factories;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<AuditLog> */
class AuditLogFactory extends Factory
{
    protected $model = AuditLog::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'action' => fake()->randomElement(['profile.updated', 'card.frozen', 'account.viewed']),
            'entity_type' => 'account',
            'entity_id' => (string) fake()->numberBetween(1, 100000),
            'ip_address' => fake()->ipv4(),
            'user_agent' => fake()->userAgent(),
            'metadata' => ['source' => 'demo'],
            'created_at' => fake()->dateTimeBetween('-90 days', 'now'),
        ];
    }
}
