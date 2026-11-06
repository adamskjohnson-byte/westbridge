<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Models\AuditLog;
use App\Models\User;
use App\Notifications\PasswordChangedNotification;
use App\Support\ApiResponse;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

class ResetPasswordController extends Controller
{
    public function __invoke(ResetPasswordRequest $request): JsonResponse
    {
        $attributes = $request->validated();
        $status = Password::reset(
            [
                'email' => $attributes['email'],
                'token' => $attributes['token'],
                'password' => $attributes['password'],
                'password_confirmation' => $attributes['password_confirmation'],
            ],
            function ($user, string $password) use ($request): void {
                DB::transaction(function () use ($user, $password, $request): void {
                    $user->forceFill([
                        'password' => Hash::make($password),
                        'remember_token' => Str::random(60),
                    ])->save();

                    // A reset invalidates every browser session, not only the current one.
                    DB::table(config('session.table', 'sessions'))->where('user_id', $user->getKey())->delete();

                    AuditLog::create([
                        'user_id' => $user->getKey(),
                        'action' => 'auth.password_reset',
                        'entity_type' => 'user',
                        'entity_id' => (string) $user->getKey(),
                        'ip_address' => $request->ip(),
                        'user_agent' => mb_substr((string) $request->userAgent(), 0, 255),
                        'created_at' => now(),
                    ]);
                }, 3);
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            $user = User::query()->where('email', $attributes['email'])->first();
            AuditLog::create([
                'user_id' => $user?->getKey(),
                'action' => 'auth.password_reset_failed',
                'entity_type' => 'user',
                'entity_id' => $user === null ? null : (string) $user->getKey(),
                'ip_address' => $request->ip(),
                'user_agent' => mb_substr((string) $request->userAgent(), 0, 255),
                'metadata' => ['email_sha256' => hash('sha256', $attributes['email'])],
                'created_at' => now(),
            ]);

            return response()->json([
                'code' => 'validation_failed',
                'message' => 'The given data was invalid.',
                'errors' => ['email' => ['validation.reset_token_invalid']],
            ], 422);
        }

        $user = User::query()->where('email', $attributes['email'])->firstOrFail();
        event(new PasswordReset($user));
        $user->notify(new PasswordChangedNotification);

        return ApiResponse::success(null, 'Your password has been reset.');
    }
}
