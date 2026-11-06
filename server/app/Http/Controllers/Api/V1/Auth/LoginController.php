<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Services\AuthService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

class LoginController extends Controller
{
    public function __invoke(LoginRequest $request, AuthService $auth): JsonResponse
    {
        $result = $auth->login(
            $request->validated('email'),
            $request->validated('password'),
            (bool) $request->validated('remember', false),
            $request,
        );

        if (is_array($result)) {
            return response()->json(['code' => 'two_factor_required', 'data' => $result], Response::HTTP_ACCEPTED);
        }

        return ApiResponse::success(new UserResource($result), 'Logged in.');
    }
}
