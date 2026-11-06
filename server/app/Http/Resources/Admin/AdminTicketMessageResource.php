<?php

namespace App\Http\Resources\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AdminTicketMessageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (int) $this->id,
            'type' => $this->type,
            'body' => $this->body,
            'admin' => $this->whenLoaded('admin', fn () => $this->admin ? [
                'id' => (int) $this->admin->id,
                'name' => trim($this->admin->first_name.' '.$this->admin->last_name),
            ] : null),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
