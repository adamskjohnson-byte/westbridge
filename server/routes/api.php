<?php

use App\Http\Controllers\Api\V1\Auth\ForgotPasswordController;
use App\Http\Controllers\Api\V1\Auth\LoginController;
use App\Http\Controllers\Api\V1\Auth\LogoutController;
use App\Http\Controllers\Api\V1\Auth\MeController;
use App\Http\Controllers\Api\V1\Auth\RegisterController;
use App\Http\Controllers\Api\V1\Auth\ResendVerificationController;
use App\Http\Controllers\Api\V1\Auth\ResetPasswordController;
use App\Http\Controllers\Api\V1\Auth\VerifyEmailController;
use App\Http\Controllers\Api\V1\BeneficiaryController;
use App\Http\Controllers\Api\V1\BillPaymentController;
use App\Http\Controllers\Api\V1\CardController;
use App\Http\Controllers\Api\V1\ConfigController;
use App\Http\Controllers\Api\V1\ContactController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\NewsletterController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\SettingsController;
use App\Http\Controllers\Api\V1\InsightsController;
use App\Http\Controllers\Api\V1\Admin\AdminController;
use App\Http\Controllers\Api\V1\MoneyReadController;
use App\Http\Controllers\Api\V1\TransferController;
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

    if (app()->environment('local')) {
        Route::get('/e2e/health', static function (\Illuminate\Http\Request $request) {
            $connection = (string) config('database.default');
            $database = (string) config('database.connections.'.$connection.'.database');
            $requestedDatabase = (string) $request->query('database');
            $safe = in_array($connection, ['mysql', 'mariadb'], true)
                && preg_match('/^[A-Za-z0-9_]+_e2e$/', $database) === 1
                && hash_equals($database, $requestedDatabase);

            return response()->json(['safe' => $safe], $safe ? 200 : 503);
        });
    }

    Route::post('/newsletter', NewsletterController::class)->middleware(['throttle:public-forms', 'turnstile']);
    Route::post('/contact', ContactController::class)->middleware(['throttle:public-forms', 'turnstile']);

    Route::middleware(['auth:sanctum', 'verified', 'active'])->group(function () {
        Route::get('/settings', [SettingsController::class, 'show']);
        Route::patch('/settings/profile', [SettingsController::class, 'profile']);
        Route::patch('/settings/preferences', [SettingsController::class, 'preferences']);
        Route::post('/settings/password', [SettingsController::class, 'password']);
        Route::post('/settings/security/two-factor/start', [SettingsController::class, 'twoFactorStart']);
        Route::post('/settings/security/two-factor/confirm', [SettingsController::class, 'twoFactorConfirm']);
        Route::get('/settings/sessions', [SettingsController::class, 'sessions']);
        Route::delete('/settings/sessions/{handle}', [SettingsController::class, 'revokeSession']);
        Route::post('/settings/sessions/revoke-others', [SettingsController::class, 'revokeOthers']);
        Route::get('/insights', InsightsController::class);
        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
        Route::post('/notifications/read-all', [NotificationController::class, 'readAll']);
        Route::post('/notifications/{id}/read', [NotificationController::class, 'read']);
        Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);
        Route::get('/cards', [CardController::class, 'index']);
        Route::post('/cards', [CardController::class, 'store']);
        Route::patch('/cards/{card}', [CardController::class, 'update']);
        Route::post('/cards/{card}/freeze', [CardController::class, 'freeze']);
        Route::post('/cards/{card}/unfreeze', [CardController::class, 'unfreeze']);
        Route::post('/cards/{card}/cancel', [CardController::class, 'cancel']);
        Route::post('/cards/{card}/test-purchase', [CardController::class, 'testPurchase'])->middleware('throttle:card-purchases');
        Route::get('/beneficiaries', [BeneficiaryController::class, 'index']);
        Route::post('/beneficiaries', [BeneficiaryController::class, 'store']);
        Route::delete('/beneficiaries/{beneficiary}', [BeneficiaryController::class, 'destroy']);
        Route::post('/transfers/lookup', [BeneficiaryController::class, 'lookup'])->middleware('throttle:recipient-lookup');
        Route::get('/transfers/own', [MoneyReadController::class, 'ownAccounts']);
        Route::get('/transfers', [TransferController::class, 'index']);
        Route::post('/transfers', [TransferController::class, 'store'])->middleware('throttle:transfers');
        Route::get('/transfers/{transfer}', [TransferController::class, 'show']);
        Route::get('/limits', [MoneyReadController::class, 'limits']);
        Route::get('/billers', [MoneyReadController::class, 'billers']);
        Route::get('/bill-payments', [MoneyReadController::class, 'billPayments']);
        Route::post('/bill-payments', [BillPaymentController::class, 'store'])->middleware('throttle:transfers');
        Route::get('/accounts', [DashboardController::class, 'accounts']);
        Route::get('/accounts/{account}', [DashboardController::class, 'account']);
        Route::get('/accounts/{account}/transactions', [DashboardController::class, 'transactions']);
        Route::get('/accounts/{account}/transactions/export', [DashboardController::class, 'exportTransactions'])
            ->middleware('throttle:transaction-export');
        Route::get('/accounts/{account}/transactions/{reference}', [DashboardController::class, 'transaction']);
        Route::get('/dashboard/summary', [DashboardController::class, 'summary']);
    });

    Route::prefix('admin')->middleware(['auth:sanctum', 'verified', 'active', 'role:admin', 'throttle:admin'])->group(function () {
        Route::get('/overview', [AdminController::class, 'overview']);
        Route::get('/system/reconcile', [AdminController::class, 'reconcile'])->middleware('throttle:admin-reconcile');
        Route::get('/users', [AdminController::class, 'users']);
        Route::get('/users/{user}', [AdminController::class, 'user']);
        Route::post('/users/{user}/suspend', [AdminController::class, 'suspend']);
        Route::post('/users/{user}/reactivate', [AdminController::class, 'reactivate']);
        Route::post('/accounts/{account}/freeze', [AdminController::class, 'freeze']);
        Route::post('/accounts/{account}/unfreeze', [AdminController::class, 'unfreeze']);
        Route::get('/transactions', [AdminController::class, 'transactions']);
        Route::get('/tickets', [AdminController::class, 'tickets']);
        Route::get('/tickets/{ticket}', [AdminController::class, 'ticket']);
        Route::patch('/tickets/{ticket}', [AdminController::class, 'updateTicket']);
        Route::post('/tickets/{ticket}/messages', [AdminController::class, 'ticketMessage']);
        Route::get('/audit-logs', [AdminController::class, 'auditLogs']);
        Route::get('/audit-logs/actions', [AdminController::class, 'auditActions']);
    });

    Route::prefix('auth')->group(function () {
        Route::post('/register', RegisterController::class)->middleware(['throttle:register', 'turnstile']);
        Route::post('/login', LoginController::class)->middleware(['throttle:login', 'turnstile']);
        Route::post('/two-factor/verify', [\App\Http\Controllers\Api\V1\Auth\TwoFactorController::class, 'verify'])->middleware('throttle:two-factor');
        Route::post('/two-factor/resend', [\App\Http\Controllers\Api\V1\Auth\TwoFactorController::class, 'resend'])->middleware('throttle:two-factor');
        Route::get('/email/verify/{id}/{hash}', VerifyEmailController::class)
            ->middleware('throttle:auth')
            ->name('api.v1.auth.email.verify');
        Route::post('/forgot-password', ForgotPasswordController::class)->middleware(['throttle:password-recovery', 'turnstile']);
        Route::post('/reset-password', ResetPasswordController::class)->middleware(['throttle:password-recovery', 'turnstile']);

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
