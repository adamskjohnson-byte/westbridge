<?php

use App\Exceptions\Auth\AccountSuspendedException;
use App\Exceptions\Auth\InvalidVerificationLinkException;
use App\Exceptions\Bank\BankException;
use App\Http\Middleware\EnsureEmailIsVerified;
use App\Http\Middleware\EnsureUserIsActive;
use App\Http\Middleware\EnsureUserRole;
use App\Http\Middleware\RequestId;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
    )
    ->withCommands()
    ->withMiddleware(function (Middleware $middleware) {
        // Add correlation and security headers globally; each middleware limits itself to API URLs.
        $middleware->append([RequestId::class, SecurityHeaders::class]);
        $middleware->redirectGuestsTo(fn (Request $request): ?string => $request->is('api/*') ? null : route('login'));
        $middleware->statefulApi();
        $middleware->api(append: ['throttle:api']);
        $middleware->alias([
            'active' => EnsureUserIsActive::class,
            'verified' => EnsureEmailIsVerified::class,
            'role' => EnsureUserRole::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Force JSON for API URLs and normalize expected and unexpected API exceptions.
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request, Throwable $exception): bool => $request->is('api/*') || $request->expectsJson(),
        );

        $exceptions->render(function (Throwable $exception, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            $requestId = (string) ($request->attributes->get('request_id') ?? 'unknown');
            $status = match (true) {
                $exception instanceof BankException => 422,
                $exception instanceof AccountSuspendedException => 403,
                $exception instanceof InvalidVerificationLinkException => 403,
                $exception instanceof ValidationException => $exception->status,
                $exception instanceof TokenMismatchException => 419,
                $exception instanceof AuthenticationException => 401,
                $exception instanceof AuthorizationException => 403,
                $exception instanceof ModelNotFoundException => 404,
                $exception instanceof NotFoundHttpException => 404,
                $exception instanceof ThrottleRequestsException => 429,
                $exception instanceof HttpExceptionInterface => $exception->getStatusCode(),
                default => 500,
            };

            $message = match (true) {
                $exception instanceof BankException => $exception->getMessage(),
                $exception instanceof AccountSuspendedException => $exception->getMessage(),
                $exception instanceof InvalidVerificationLinkException => $exception->getMessage(),
                $exception instanceof ValidationException => 'The given data was invalid.',
                $exception instanceof TokenMismatchException => 'CSRF token mismatch.',
                $exception instanceof AuthenticationException => 'Unauthenticated.',
                $exception instanceof AuthorizationException => 'Forbidden.',
                $exception instanceof ModelNotFoundException, $exception instanceof NotFoundHttpException => 'Resource not found.',
                $exception instanceof ThrottleRequestsException => 'Too many requests.',
                default => 'Something went wrong.',
            };

            $code = match (true) {
                $exception instanceof BankException => $exception->machineCode(),
                $exception instanceof AccountSuspendedException => 'account_suspended',
                $exception instanceof InvalidVerificationLinkException => 'invalid_verification_link',
                $exception instanceof ValidationException => 'validation_failed',
                $exception instanceof TokenMismatchException => 'csrf_mismatch',
                $exception instanceof AuthenticationException => 'unauthenticated',
                $exception instanceof AuthorizationException => 'forbidden',
                $exception instanceof ModelNotFoundException, $exception instanceof NotFoundHttpException => 'not_found',
                $exception instanceof ThrottleRequestsException => 'too_many_requests',
                $status === 401 => 'unauthenticated',
                $status === 403 => 'forbidden',
                $status === 404 => 'not_found',
                $status === 419 => 'csrf_mismatch',
                $status === 422 => 'validation_failed',
                $status === 429 => 'too_many_requests',
                $status >= 500 => 'server_error',
                default => 'http_error',
            };
            $payload = ['code' => $code, 'message' => $message];

            if ($exception instanceof ValidationException) {
                $payload['errors'] = $exception->errors();
            } elseif ($status === 500) {
                Log::withContext(['request_id' => $requestId]);
                try {
                    Log::error('Unhandled API exception', ['exception' => $exception]);
                } finally {
                    Log::withoutContext(['request_id']);
                }

                if (config('app.debug')) {
                    $payload['debug'] = [
                        'exception' => $exception::class,
                        'detail' => $exception->getMessage(),
                    ];
                }
            }

            $response = response()->json($payload, $status);

            if ($exception instanceof ThrottleRequestsException) {
                $response->headers->set('Retry-After', $exception->getHeaders()['Retry-After'] ?? '60');
            }

            $response->headers->set('X-Request-Id', $requestId);

            return SecurityHeaders::apply($response);
        });
    })->create();
