<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreContactRequest;
use App\Mail\ContactReceivedMail;
use App\Models\SupportTicket;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Mail;

class ContactController extends Controller
{
    public function __invoke(StoreContactRequest $request): JsonResponse
    {
        $message = "Message received. We'll reply soon.";

        if ($request->filled('website')) {
            return response()->json(['message' => $message]);
        }

        $ticket = SupportTicket::create([
            'user_id' => null,
            ...$request->validated(),
        ]);

        Mail::to($ticket->email)->send(new ContactReceivedMail('WB-'.str_pad((string) $ticket->getKey(), 8, '0', STR_PAD_LEFT)));

        return response()->json(['message' => $message], 201);
    }
}
