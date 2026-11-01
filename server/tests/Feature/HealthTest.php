<?php

namespace Tests\Feature;

use Tests\TestCase;

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
}