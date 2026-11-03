<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Database\Seeder;

class DemoUsersSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local', 'testing')) {
            return;
        }

        User::factory()->create([
            'first_name' => 'Morgan',
            'last_name' => 'Reed',
            'email' => 'admin@westbridge.test',
            'password' => 'Password123!',
            'role' => UserRole::Admin,
            'status' => UserStatus::Active,
        ]);

        $customers = [
            ['first_name' => 'Avery', 'last_name' => 'Bennett', 'email' => 'customer@westbridge.test'],
            ['first_name' => 'Jordan', 'last_name' => 'Kim', 'email' => 'jordan.kim@westbridge.test'],
            ['first_name' => 'Riley', 'last_name' => 'Patel', 'email' => 'riley.patel@westbridge.test'],
            ['first_name' => 'Casey', 'last_name' => 'Morgan', 'email' => 'casey.morgan@westbridge.test'],
            ['first_name' => 'Taylor', 'last_name' => 'Brooks', 'email' => 'taylor.brooks@westbridge.test'],
        ];

        foreach ($customers as $customer) {
            User::factory()->create([
                ...$customer,
                'password' => 'Password123!',
                'role' => UserRole::Customer,
                'status' => UserStatus::Active,
            ]);
        }
    }
}
