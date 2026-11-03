<?php

use App\Http\Controllers\Api\V1\Auth\ForgotPasswordController;
use App\Http\Controllers\Api\V1\Auth\LoginController;
use App\Http\Controllers\Api\V1\Auth\LogoutController;
use App\Http\Controllers\Api\V1\Auth\MeController;
use App\Http\Controllers\Api\V1\Auth\RegisterController;
use App\Http\Controllers\Api\V1\Auth\ResendVerificationController;
use App\Http\Controllers\Api\V1\Auth\ResetPasswordController;
use App\Http\Controllers\Api\V1\Auth\VerifyEmailController;
use App\Http\Controllers\Api\V1\ConfigController;
use App\Http\Controllers\Api\V1\ContactController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\NewsletterController;
use App\Support\ApiResponse;
use Illuminate\Support\Facades\Route;

// Keep the infrastructure health check stable while feature endpoints evolve under v1.
Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'app' => 'Westbridge National Bank',
        'time' => now()->toISOString(),
    ]);
});

Route::prefix('v1')->group(function () {
    Route::get('/config', ConfigController::class);
    Route::get('/ping', fn () => ApiResponse::success(['status' => 'ok']));

    Route::post('/newsletter', NewsletterController::class)->middleware('throttle:public-forms');
    Route::post('/contact', ContactController::class)->middleware('throttle:public-forms');

    Route::middleware(['auth:sanctum', 'verified', 'active'])->group(function () {
        Route::get('/accounts', [DashboardController::class, 'accounts']);
        Route::get('/accounts/{account}', [DashboardController::class, 'account']);
        Route::get('/accounts/{account}/transactions', [DashboardController::class, 'transactions']);
        Route::get('/accounts/{account}/transactions/export', [DashboardController::class, 'exportTransactions'])
            ->middleware('throttle:transaction-export');
        Route::get('/accounts/{account}/transactions/{reference}', [DashboardController::class, 'transaction']);
        Route::get('/dashboard/summary', [DashboardController::class, 'summary']);
    });

    Route::prefix('auth')->middleware('throttle:auth')->group(function () {
        Route::post('/register', RegisterController::class);
        Route::post('/login', LoginController::class);
        Route::get('/email/verify/{id}/{hash}', VerifyEmailController::class)
            ->middleware('throttle:auth')
            ->name('api.v1.auth.email.verify');
        Route::post('/forgot-password', ForgotPasswordController::class);
        Route::post('/reset-password', ResetPasswordController::class);

        Route::middleware('auth:sanctum')->group(function () {
            Route::post('/logout', LogoutController::class);
            Route::get('/me', MeController::class);
            Route::post('/email/resend', ResendVerificationController::class)->middleware('throttle:3,1');
        });
    });

    if (app()->environment('testing')) {
        Route::prefix('test/protected')->middleware(['auth:sanctum', 'verified', 'active'])->group(function () {
            Route::get('/me', fn () => response()->json(['id' => request()->user()->getKey()]));
            Route::get('/admin', fn () => response()->json(['ok' => true]))->middleware('role:admin');
        });
    }
});
