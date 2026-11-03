<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreNewsletterRequest;
use App\Models\NewsletterSubscriber;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

class NewsletterController extends Controller
{
    public function __invoke(StoreNewsletterRequest $request): JsonResponse
    {
        NewsletterSubscriber::query()->firstOrCreate(
            ['email' => $request->validated('email')],
            [
                'unsubscribe_token' => Str::random(40),
                'subscribed_at' => now(),
            ],
        );

        return response()->json(['message' => 'Thanks for subscribing.']);
    }
}
