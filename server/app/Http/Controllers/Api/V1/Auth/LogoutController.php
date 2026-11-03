<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Services\AuthService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class LogoutController extends Controller
{
    public function __invoke(Request $request, AuthService $auth)
    {
        $auth->logout($request->user(), $request);

        return ApiResponse::noContent();
    }
}
