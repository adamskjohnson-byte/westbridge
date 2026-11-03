<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureEmailIsVerified
{
    public function handle(Request $request, Closure $next): Response
    {
        if (config('bank.auth.require_email_verification', true)
            && $request->user() !== null
            && ! $request->user()->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Your email address has not been verified.',
                'code' => 'email_not_verified',
            ], 403);
        }

        return $next($request);
    }
}
