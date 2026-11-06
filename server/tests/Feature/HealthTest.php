<?php

namespace Tests\Feature;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Support\Facades\Route;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Tests\TestCase;

// Exercise the versioned API foundation and its shared response middleware.
class HealthTest extends TestCase
{
    public function test_health_endpoint_returns_service_status_and_iso_timestamp(): void
    {
        $response = $this->getJson('/api/health');

        $response->assertOk()->assertJson([
            'status' => 'ok',
            'app' => 'Westbridge National Bank',
        ]);

        $this->assertMatchesRegularExpression(
            '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/',
            $response->json('time'),
        );
    }

    public function test_unknown_api_route_returns_the_standard_json_error_shape(): void
    {
        $this->get('/api/v1/missing')
            ->assertNotFound()
            ->assertExactJson(['code' => 'not_found', 'message' => 'Resource not found.']);
    }

    public function test_auth_and_csrf_errors_have_stable_codes(): void
    {
        Route::get('/api/v1/test-unauthenticated', static function () {
            throw new AuthenticationException;
        });
        Route::get('/api/v1/test-forbidden', static function () {
            throw new AuthorizationException;
        });
        Route::get('/api/v1/test-csrf', static function () {
            throw new TokenMismatchException;
        });

        $this->getJson('/api/v1/test-unauthenticated')->assertUnauthorized()->assertJsonPath('code', 'unauthenticated');
        $this->getJson('/api/v1/test-forbidden')->assertForbidden()->assertJsonPath('code', 'forbidden');
        $this->getJson('/api/v1/test-csrf')->assertStatus(419)->assertJsonPath('code', 'csrf_mismatch');
    }

    public function test_guest_request_to_protected_api_route_returns_json_unauthenticated_without_accept_header(): void
    {
        $this->get('/api/v1/accounts')
            ->assertUnauthorized()
            ->assertExactJson(['code' => 'unauthenticated', 'message' => 'Unauthenticated.']);
    }

    public function test_versioned_ping_uses_the_api_success_helper(): void
    {
        $this->getJson('/api/v1/ping')
            ->assertOk()
            ->assertJsonPath('message', 'OK')
            ->assertJsonPath('data.status', 'ok');
    }

    public function test_api_server_errors_do_not_expose_exception_details_when_debug_is_disabled(): void
    {
        config(['app.debug' => false]);
        Route::get('/api/v1/test-error', static function () {
            throw new RuntimeException('private database detail');
        });

        $this->getJson('/api/v1/test-error')
            ->assertStatus(500)
            ->assertExactJson([
                'code' => 'server_error',
                'message' => 'Something went wrong.',
            ])
            ->assertDontSee('private database detail');
    }

    public function test_api_validation_errors_use_the_required_json_shape(): void
    {
        Route::post('/api/v1/test-validation', static function () {
            throw ValidationException::withMessages(['email' => ['validation.email_invalid']]);
        })->middleware('api');

        $this->post('/api/v1/test-validation', ['email' => 'not-an-email'])
            ->assertUnprocessable()
            ->assertExactJson([
                'code' => 'validation_failed',
                'message' => 'The given data was invalid.',
                'errors' => ['email' => ['validation.email_invalid']],
            ]);
    }

    public function test_api_response_has_a_generated_request_id_and_security_headers(): void
    {
        $response = $this->get('/api/health')
            ->assertOk()
            ->assertHeader('X-Request-Id')
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('Referrer-Policy', 'no-referrer')
            ->assertHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
            ->assertHeader('Cross-Origin-Opener-Policy', 'same-origin')
            ->assertHeader('Cross-Origin-Resource-Policy', 'same-site')
            ->assertHeader('X-Permitted-Cross-Domain-Policies', 'none')
            ->assertHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
            ->assertHeaderContains('Cache-Control', 'no-store');

        $this->assertMatchesRegularExpression('/^[0-9A-HJKMNP-TV-Z]{26}$/', $response->headers->get('X-Request-Id'));
    }

    public function test_hsts_is_only_sent_for_secure_production_api_requests(): void
    {
        $plain = SecurityHeaders::apply(new Response, Request::create('http://api.example.test/api/health'));
        $this->assertFalse($plain->headers->has('Strict-Transport-Security'));
        app()->instance('env', 'production');
        $secure = SecurityHeaders::apply(new Response, Request::create('https://api.example.test/api/health'));
        $this->assertSame('max-age=31536000; includeSubDomains', $secure->headers->get('Strict-Transport-Security'));
    }

    public function test_request_id_header_is_preserved(): void
    {
        $this->withHeader('X-Request-Id', 'test-request-123')
            ->get('/api/health')
            ->assertHeader('X-Request-Id', 'test-request-123');
    }

    public function test_throttle_errors_include_retry_after(): void
    {
        Route::get('/api/v1/test-throttle', static function () {
            throw new ThrottleRequestsException('Too many requests.', headers: ['Retry-After' => '17']);
        });

        $this->get('/api/v1/test-throttle')
            ->assertStatus(429)
            ->assertJsonPath('code', 'too_many_requests')
            ->assertExactJson(['code' => 'too_many_requests', 'message' => 'Too many requests.'])
            ->assertHeader('Retry-After', '17');
    }
}
