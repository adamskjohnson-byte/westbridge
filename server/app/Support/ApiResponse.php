<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

// Standard response helpers keep controller payloads consistent across the API.
class ApiResponse
{
    public static function success(mixed $data = null, string $message = 'OK'): JsonResponse
    {
        return response()->json([
            'message' => $message,
            'data' => $data,
        ]);
    }

    public static function created(mixed $data = null, string $message = 'Created'): JsonResponse
    {
        return response()->json([
            'message' => $message,
            'data' => $data,
        ], 201);
    }

    public static function noContent(): Response
    {
        return response()->noContent();
    }
}
