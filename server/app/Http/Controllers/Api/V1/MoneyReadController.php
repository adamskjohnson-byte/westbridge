<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Money\BillPaymentIndexRequest;
use App\Http\Requests\Money\TransferIndexRequest;
use App\Http\Resources\BillPaymentResource;
use App\Models\Account;
use App\Services\BeneficiaryService;
use App\Http\Resources\TransferResource;
use App\Services\BillerCatalogService;
use App\Services\MoneyMovementReadService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MoneyReadController extends Controller
{
    public function __construct(
        private readonly MoneyMovementReadService $readService,
        private readonly BillerCatalogService $billerCatalog,
    ) {}

    public function limits(Request $request): JsonResponse
    {
        $now = CarbonImmutable::now('UTC');
        $limit = $this->readService->dailyLimitCents();
        $used = $this->readService->usedToday($request->user(), $now);

        return response()->json([
            'data' => [
                'daily_limit_cents' => $limit,
                'used_today_cents' => $used,
                'remaining_cents' => max(0, $limit - $used),
                'resets_at' => $now->startOfDay()->addDay()->toISOString(),
            ],
        ]);
    }

    public function billers(): JsonResponse
    {
        return response()->json(['data' => $this->billerCatalog->all()]);
    }

    public function ownAccounts(Request $request): JsonResponse
    {
        $accounts = $request->user()->accounts()
            ->where('status', 'active')
            ->orderBy('id')
            ->get(['id', 'type', 'nickname', 'currency', 'balance_cents', 'account_number']);

        return response()->json(['data' => $accounts->map(static fn (Account $account): array => [
            'id' => (int) $account->getKey(),
            'type' => $account->type->value,
            'nickname' => $account->nickname,
            'currency' => $account->currency,
            'balance_cents' => (int) $account->balance_cents,
            'number_masked' => BeneficiaryService::maskAccountNumber($account->account_number),
        ])]);
    }

    public function transfers(TransferIndexRequest $request): JsonResponse
    {
        $paginator = $this->readService->transfers($request->user(), $request->validated());

        return response()->json([
            'data' => TransferResource::collection($paginator->getCollection())->resolve($request),
            'meta' => [
                'page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    public function billPayments(BillPaymentIndexRequest $request): JsonResponse
    {
        $paginator = $this->readService->billPayments($request->user(), (int) $request->validated('page', 1));

        return response()->json([
            'data' => BillPaymentResource::collection($paginator->getCollection())->resolve($request),
            'meta' => [
                'page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }
}
