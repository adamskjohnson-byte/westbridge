<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\TransactionFilterRequest;
use App\Http\Resources\AccountDetailResource;
use App\Http\Resources\AccountResource;
use App\Http\Resources\DashboardSummaryResource;
use App\Http\Resources\TransactionResource;
use App\Models\Account;
use App\Models\Card;
use App\Services\DashboardReadService;
use App\Services\TransactionExportService;
use App\Services\TransactionReadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DashboardController extends Controller
{
    public function __construct(
        private readonly DashboardReadService $dashboardReadService,
        private readonly TransactionReadService $transactionReadService,
        private readonly TransactionExportService $transactionExportService,
    ) {}

    public function accounts(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Account::class);

        return AccountResource::collection($this->dashboardReadService->accounts($request->user()))->response();
    }

    public function account(Request $request, int $account): AccountDetailResource
    {
        $ownedAccount = $this->dashboardReadService->account($request->user(), $account);
        Gate::authorize('view', $ownedAccount);

        return new AccountDetailResource($ownedAccount);
    }

    public function transactions(TransactionFilterRequest $request, int $account): JsonResponse
    {
        $user = $request->user();
        $ownedAccount = $this->dashboardReadService->account($user, $account);
        Gate::authorize('view', $ownedAccount);
        $filters = $request->filters();
        if (isset($filters['card_id']) && ! Card::query()->whereKey($filters['card_id'])->where('user_id', $user->getKey())->exists()) {
            abort(404);
        }
        $paginator = $this->transactionReadService->paginate($user, $ownedAccount, $filters);

        return response()->json([
            'data' => TransactionResource::collection($paginator->getCollection())->resolve($request),
            'meta' => [
                'page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    public function transaction(Request $request, int $account, string $reference): TransactionResource
    {
        $user = $request->user();
        $ownedAccount = $this->dashboardReadService->account($user, $account);
        Gate::authorize('view', $ownedAccount);

        return new TransactionResource($this->transactionReadService->findByReference($user, $ownedAccount, $reference));
    }

    public function summary(Request $request): JsonResponse
    {
        $summary = $this->dashboardReadService->summary($request->user());

        return response()->json(DashboardSummaryResource::make($summary)->resolve($request));
    }

    public function exportTransactions(
        TransactionFilterRequest $request,
        int $account,
    ): StreamedResponse {
        $user = $request->user();
        $ownedAccount = $this->dashboardReadService->account($user, $account);
        Gate::authorize('view', $ownedAccount);

        return $this->transactionExportService->export($user, $ownedAccount, $request->filters(), $request);
    }
}
