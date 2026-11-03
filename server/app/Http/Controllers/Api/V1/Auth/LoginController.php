<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Services\AuthService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

class LoginController extends Controller
{
    public function __invoke(LoginRequest $request, AuthService $auth): JsonResponse
    {
        $user = $auth->login(
            $request->validated('email'),
            $request->validated('password'),
            (bool) $request->validated('remember', false),
            $request,
        );

        return ApiResponse::success(new UserResource($user), 'Logged in.');
    }
}
