<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AdminCreate extends Command
{
    protected $signature = 'admin:create {email}';

    protected $description = 'Create a verified administrator account';

    public function handle(): int
    {
        $email = strtolower(trim((string) $this->argument('email')));
        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->error('Enter a valid email address.');

            return self::FAILURE;
        }
        if (User::query()->where('email', $email)->exists()) {
            $this->error('A user with that email already exists.');

            return self::FAILURE;
        }

        $firstName = trim((string) $this->ask('First name'));
        $lastName = trim((string) $this->ask('Last name'));
        $password = (string) $this->secret('Password');
        $confirmation = (string) $this->secret('Confirm password');
        if ($password !== $confirmation) {
            $this->error('Password confirmation does not match.');

            return self::FAILURE;
        }
        try {
            validator(['password' => $password], [
                'password' => ['required', 'string', Password::min(12)->mixedCase()->numbers()->symbols()],
            ])->validate();
        } catch (ValidationException) {
            $this->error('Password must be at least 12 characters and include upper, lower, number, and symbol characters.');

            return self::FAILURE;
        }
        if ($firstName === '' || $lastName === '') {
            $this->error('First and last name are required.');

            return self::FAILURE;
        }

        $admin = new User([
            'first_name' => $firstName,
            'last_name' => $lastName,
            'email' => $email,
            'password' => Hash::make($password),
            'role' => UserRole::Admin,
            'status' => UserStatus::Active,
        ]);
        $admin->email_verified_at = now();
        $admin->save();
        AuditLog::create([
            'user_id' => $admin->getKey(),
            'action' => 'admin.created',
            'entity_type' => 'user',
            'entity_id' => (string) $admin->getKey(),
            'metadata' => ['via' => 'cli'],
            'created_at' => now(),
        ]);

        $this->info('Administrator created: '.$email);

        return self::SUCCESS;
    }
}
