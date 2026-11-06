<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Money\RecipientLookupRequest;
use App\Http\Requests\Money\StoreBeneficiaryRequest;
use App\Http\Resources\BeneficiaryResource;
use App\Services\BeneficiaryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BeneficiaryController extends Controller
{
    public function __construct(private readonly BeneficiaryService $beneficiaryService) {}

    public function index(Request $request): JsonResponse
    {
        return BeneficiaryResource::collection($this->beneficiaryService->list($request->user()))->response();
    }

    public function store(StoreBeneficiaryRequest $request): JsonResponse
    {
        $data = $request->validated();
        $beneficiary = $this->beneficiaryService->create($request->user(), $data['account_number'], $data['nickname'] ?? null);

        return (new BeneficiaryResource($beneficiary))->response()->setStatusCode(201);
    }

    public function destroy(Request $request, int $beneficiary): JsonResponse
    {
        $this->beneficiaryService->delete($request->user(), $beneficiary);

        return response()->json([], 204);
    }

    public function lookup(RecipientLookupRequest $request): JsonResponse
    {
        $result = $this->beneficiaryService->lookup(
            $request->user(),
            $request->validated('account_number'),
            $request->ip(),
            $request->userAgent(),
        );

        return response()->json(['data' => $result]);
    }
}
