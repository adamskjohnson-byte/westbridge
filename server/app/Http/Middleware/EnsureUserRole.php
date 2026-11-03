<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserRole
{
    public function handle(Request $request, Closure $next, string $role): Response
    {
        $user = $request->user();
        $requiredRole = UserRole::tryFrom($role);

        if ($user === null || $requiredRole === null || $user->role !== $requiredRole) {
            return response()->json([
                'message' => 'This action is unauthorized.',
                'code' => 'role_forbidden',
            ], 403);
        }

        return $next($request);
    }
}
