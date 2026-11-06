<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\Bank\CardOperationException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Cards\StoreCardRequest;
use App\Http\Requests\Cards\CancelCardRequest;
use App\Http\Requests\Cards\TestCardPurchaseRequest;
use App\Http\Requests\Cards\UpdateCardRequest;
use App\Http\Resources\CardResource;
use App\Models\AuditLog;
use App\Models\Card;
use App\Services\CardService;
use App\Services\LedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CardController extends Controller
{
    public function __construct(private readonly CardService $cards, private readonly LedgerService $ledger) {}

    public function index(Request $request): JsonResponse
    {
        return CardResource::collection($this->cards->index($request->user(), $request->boolean('include') && $request->query('include') === 'cancelled'))->response();
    }

    public function store(StoreCardRequest $request): JsonResponse
    {
        $card = $this->cards->issue($request->user(), (int) $request->validated('account_id'), $request->validated('nickname'));

        return (new CardResource($card))->response()->setStatusCode(201);
    }

    public function update(UpdateCardRequest $request, int $card): CardResource
    {
        $model = $this->findOwned($request, $card);

        return new CardResource($this->cards->update($request->user(), $model, $request->validated()));
    }

    public function freeze(Request $request, int $card): CardResource
    {
        return new CardResource($this->cards->transition($request->user(), $this->findOwned($request, $card), 'freeze'));
    }

    public function unfreeze(Request $request, int $card): CardResource
    {
        return new CardResource($this->cards->transition($request->user(), $this->findOwned($request, $card), 'unfreeze'));
    }

    public function cancel(CancelCardRequest $request, int $card): CardResource
    {
        return new CardResource($this->cards->transition($request->user(), $this->findOwned($request, $card), 'cancel'));
    }

    public function testPurchase(TestCardPurchaseRequest $request, int $card): JsonResponse
    {
        $model = $this->findOwned($request, $card);
        $data = $request->validated();
        $hashData = ['card_id' => $model->getKey(), ...$data];
        ksort($hashData);
        $result = $this->ledger->cardPurchase($request->user(), $model, $data['merchant'], (int) $data['amount_cents'], (string) $request->header('Idempotency-Key'), hash('sha256', json_encode($hashData, JSON_THROW_ON_ERROR)));
        if ($result['status'] === 'declined') {
            throw new CardOperationException((string) $result['code']);
        }

        return response()->json(['data' => [
            'status' => 'approved', 'transaction_id' => (int) $result['transaction_id'],
            'balance_after_cents' => (int) $result['balance_after_cents'], 'replayed' => (bool) $result['replayed'],
        ]]);
    }

    private function findOwned(Request $request, int $cardId): Card
    {
        $card = Card::query()->whereKey($cardId)->firstOrFail();
        if ((int) $card->user_id !== (int) $request->user()->getKey()) {
            abort(404);
        }

        return $card;
    }
}