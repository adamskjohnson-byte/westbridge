<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Money\StoreBillPaymentRequest;
use App\Http\Resources\BillPaymentResource;
use App\Models\BillPayment;
use App\Services\LedgerService;
use Illuminate\Http\JsonResponse;

class BillPaymentController extends Controller
{
    public function __construct(private readonly LedgerService $ledgerService) {}

    public function store(StoreBillPaymentRequest $request): JsonResponse
    {
        $data = $request->validated();
        $user = $request->user();
        $source = $user->accounts()->whereKey($data['from_account_id'])->firstOrFail();
        $hashData = $data;
        ksort($hashData);
        $requestHash = hash('sha256', json_encode($hashData, JSON_THROW_ON_ERROR));
        $existing = BillPayment::query()->where('user_id', $user->getKey())->where('idempotency_key', $request->idempotencyKey())->first();
        if ($existing !== null) {
            if (! hash_equals((string) $existing->request_hash, $requestHash)) {
                throw new \App\Exceptions\Bank\IdempotencyKeyReusedException;
            }

            return (new BillPaymentResource($existing->load(['account', 'transaction'])))->response();
        }
        $payment = $this->ledgerService->payBill(
            $user,
            $source,
            $data['biller_code'],
            $data['reference_number'],
            (int) $data['amount_cents'],
            $request->idempotencyKey(),
            $requestHash,
        );

        return (new BillPaymentResource($payment->load(['account', 'transaction'])))
            ->response()
            ->setStatusCode($payment->wasRecentlyCreated ? 201 : 200);
    }
}
