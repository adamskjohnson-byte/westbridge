<?php

namespace App\Http\Resources;

use App\Enums\TransactionDirection;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

class CardResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $start = Carbon::now('UTC')->startOfDay();
        $end = $start->copy()->addDay();
        $spent = $this->account->transactions()->where('card_id', $this->getKey())
            ->where('direction', TransactionDirection::Debit)->where('posted_at', '>=', $start)->where('posted_at', '<', $end)->sum('amount_cents');

        return [
            'id' => $this->id,
            'account_id' => (int) $this->account_id,
            'account_type' => $this->account?->type?->value,
            'type' => $this->type->value,
            'nickname' => $this->nickname,
            'last4' => $this->last4,
            'expiry_month' => (int) $this->expiry_month,
            'expiry_year' => (int) $this->expiry_year,
            'status' => $this->status->value,
            'daily_limit_cents' => (int) $this->daily_limit_cents,
            'spent_today_cents' => (int) $spent,
            'created_at' => $this->created_at?->utc()->toISOString(),
        ];
    }
}