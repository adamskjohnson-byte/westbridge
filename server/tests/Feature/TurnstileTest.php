<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class TurnstileTest extends TestCase
{
    use RefreshDatabase;

    private function contactPayload(): array
    {
        return ['name' => 'Riley Example', 'email' => 'riley@example.test', 'subject' => 'Question about a transfer', 'message' => 'I have a question about a transfer.', 'website' => ''];
    }

    public function test_disabled_turnstile_passes_without_http_call(): void
    {
        config(['security.turnstile.enabled' => false]);
        Http::fake();
        $this->postJson('/api/v1/contact', $this->contactPayload())->assertCreated();
        Http::assertNothingSent();
    }

    public function test_turnstile_missing_token_fails_with_stable_validation_shape(): void
    {
        config(['security.turnstile.enabled' => true]);
        Http::fake();
        $this->postJson('/api/v1/contact', $this->contactPayload())
            ->assertUnprocessable()->assertJsonPath('code', 'captcha_failed')
            ->assertJsonPath('errors.turnstile_token.0', 'validation.captcha_failed');
        Http::assertNothingSent();
    }

    public function test_turnstile_rejects_unsuccessful_http_error_and_timeout_without_leaking_secrets(): void
    {
        config(['security.turnstile.enabled' => true, 'security.turnstile.secret' => 'secret-for-test']);
        foreach ([
            fn () => Http::response(['success' => false, 'error-codes' => ['invalid-input-response']], 200),
            fn () => Http::response([], 500),
            fn () => throw new ConnectionException('simulated timeout'),
        ] as $fake) {
            Http::fake(['challenges.cloudflare.com/*' => $fake]);
            $response = $this->postJson('/api/v1/contact', [...$this->contactPayload(), 'turnstile_token' => 'private-token']);
            $response->assertUnprocessable()->assertJsonPath('code', 'captcha_failed');
            $this->assertStringNotContainsString('secret-for-test', $response->getContent());
            $this->assertStringNotContainsString('private-token', $response->getContent());
        }
    }

    public function test_valid_turnstile_response_passes_and_expected_hostname_is_enforced(): void
    {
        config(['security.turnstile.enabled' => true, 'security.turnstile.secret' => 'secret-for-test', 'security.turnstile.expected_hostnames' => ['demo.example.test']]);
        Http::fakeSequence('https://challenges.cloudflare.com/turnstile/v0/siteverify')
            ->push(['success' => true, 'hostname' => 'demo.example.test'], 200)
            ->push(['success' => true, 'hostname' => 'other.example.test'], 200);
        $this->postJson('/api/v1/contact', [...$this->contactPayload(), 'turnstile_token' => 'one-use-token'])->assertCreated();
        Http::assertSent(fn ($request): bool => $request['secret'] === 'secret-for-test' && $request['response'] === 'one-use-token');

        $this->postJson('/api/v1/contact', [...$this->contactPayload(), 'turnstile_token' => 'another-token'])->assertUnprocessable()->assertJsonPath('code', 'captcha_failed');
    }

    public function test_turnstile_is_attached_to_all_public_submission_routes_after_throttle(): void
    {
        $expected = ['/api/v1/auth/register', '/api/v1/auth/login', '/api/v1/auth/forgot-password', '/api/v1/auth/reset-password', '/api/v1/contact', '/api/v1/newsletter'];
        foreach ($expected as $uri) {
            $route = collect(Route::getRoutes())->first(fn ($route) => '/'.$route->uri() === $uri);
            $this->assertNotNull($route, "Missing route {$uri}");
            $middleware = $route->gatherMiddleware();
            $this->assertContains('turnstile', $middleware, "Missing Turnstile on {$uri}");
            $this->assertLessThan(array_search('turnstile', $middleware, true), array_search(collect($middleware)->first(fn ($item) => str_starts_with($item, 'throttle:')), $middleware, true));
        }
    }
}