<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\InsightsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InsightsController extends Controller
{
    public function __construct(private readonly InsightsService $insights) {}
    public function __invoke(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->insights->forMonth($request->user(), $request->query('month'))]);
    }
}