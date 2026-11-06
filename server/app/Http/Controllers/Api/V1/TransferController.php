<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\Bank\RecipientNotFoundException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Money\StoreTransferRequest;
use App\Http\Requests\Money\TransferIndexRequest;
use App\Http\Resources\TransferResource;
use App\Models\Account;
use App\Models\User;
use App\Services\BeneficiaryService;
use App\Services\LedgerService;
use App\Services\MoneyMovementReadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class TransferController extends Controller
{
    public function __construct(
        private readonly LedgerService $ledgerService,
        private readonly MoneyMovementReadService $readService,
    ) {}

    public function index(TransferIndexRequest $request): JsonResponse
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

    public function show(Request $request, string $transfer): TransferResource
    {
        return new TransferResource($this->readService->transferForParty($request->user(), $transfer));
    }

    public function store(StoreTransferRequest $request): JsonResponse
    {
        $data = $request->validated();
        $user = $request->user();
        $source = $user->accounts()->whereKey($data['from_account_id'])->firstOrFail();
        $requestHash = $this->requestHash($data);
        $idempotencyKey = $request->idempotencyKey();
        $existing = $user->initiatedTransfers()->where('idempotency_key', $idempotencyKey)->first();
        if ($existing !== null) {
            if (! hash_equals((string) $existing->request_hash, $requestHash)) {
                throw new \App\Exceptions\Bank\IdempotencyKeyReusedException;
            }

            return (new TransferResource($this->readService->transferForParty($user, $existing->getKey())))->response();
        }

        $destinationType = $data['to_type'];
        $destinationName = null;
        $numberMasked = null;
        $holderMasked = null;

        if ($destinationType === 'own') {
            $destination = $user->accounts()->whereKey($data['to_account_id'])->firstOrFail();
            if ((int) $source->getKey() === (int) $destination->getKey()) {
                throw ValidationException::withMessages(['to_account_id' => ['validation.same_account']]);
            }
            $destinationName = $destination->nickname ?: ucfirst($destination->type->value);
            $numberMasked = BeneficiaryService::maskAccountNumber($destination->account_number);
            $holderMasked = BeneficiaryService::maskHolder($user->first_name, $user->last_name);
        } elseif ($destinationType === 'beneficiary') {
            $beneficiary = $user->beneficiaries()->whereKey($data['beneficiary_id'])->firstOrFail();
            $destination = $this->activeDestination($beneficiary->account_number, $user);
            $destinationName = $beneficiary->name;
            $numberMasked = BeneficiaryService::maskAccountNumber($destination->account_number);
            $holderMasked = BeneficiaryService::maskHolder($destination->user->first_name, $destination->user->last_name);
        } else {
            $lookup = app(BeneficiaryService::class)->lookup($user, $data['account_number'], $request->ip(), $request->userAgent());
            $destination = $this->activeDestination($data['account_number'], $user);
            $destinationName = trim($destination->user->first_name.' '.$destination->user->last_name);
            $numberMasked = BeneficiaryService::maskAccountNumber($destination->account_number);
            $holderMasked = $lookup['holder_masked'];
        }

        $transfer = $this->ledgerService->transfer(
            $user,
            $source,
            $destination,
            (int) $data['amount_cents'],
            $data['memo'] ?? null,
            $idempotencyKey,
            $destinationType,
            $requestHash,
            $destinationName,
            $numberMasked,
            $holderMasked,
        );

        return (new TransferResource($this->readService->transferForParty($user, $transfer->getKey())))
            ->response()
            ->setStatusCode($transfer->wasRecentlyCreated ? 201 : 200);
    }

    private function activeDestination(string $number, User $user): Account
    {
        $account = Account::query()->with('user')
            ->where('account_number', $number)
            ->where('status', 'active')
            ->first();
        if ($account === null || (int) $account->user_id === (int) $user->getKey()) {
            throw new RecipientNotFoundException;
        }

        return $account;
    }

    private function requestHash(array $data): string
    {
        ksort($data);

        return hash('sha256', json_encode($data, JSON_THROW_ON_ERROR));
    }
}
