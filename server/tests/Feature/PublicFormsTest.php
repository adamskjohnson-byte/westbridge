<?php

namespace Tests\Feature;

use App\Mail\ContactReceivedMail;
use App\Models\NewsletterSubscriber;
use App\Models\SupportTicket;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class PublicFormsTest extends TestCase
{
    use RefreshDatabase;

    public function test_newsletter_subscription_creates_a_random_unsubscribe_token(): void
    {
        $this->postJson('/api/v1/newsletter', ['email' => 'reader@example.test'])
            ->assertOk()
            ->assertExactJson(['message' => 'Thanks for subscribing.']);

        $subscriber = NewsletterSubscriber::query()->where('email', 'reader@example.test')->firstOrFail();
        $this->assertMatchesRegularExpression('/^[A-Za-z0-9]{40}$/', $subscriber->unsubscribe_token);
    }

    public function test_duplicate_newsletter_email_returns_the_same_response_without_duplicate_rows(): void
    {
        $payload = ['email' => 'already-here@example.test'];

        $first = $this->postJson('/api/v1/newsletter', $payload);
        $second = $this->postJson('/api/v1/newsletter', $payload);

        $first->assertOk()->assertExactJson(['message' => 'Thanks for subscribing.']);
        $second->assertOk()->assertExactJson(['message' => 'Thanks for subscribing.']);
        $this->assertDatabaseCount('newsletter_subscribers', 1);
    }

    public function test_newsletter_validation_errors_use_the_api_json_envelope(): void
    {
        $this->postJson('/api/v1/newsletter', ['email' => 'not-an-email'])
            ->assertUnprocessable()
            ->assertJsonStructure(['message', 'errors' => ['email']]);
    }

    public function test_contact_submission_creates_an_anonymous_ticket(): void
    {
        Mail::fake();

        $this->postJson('/api/v1/contact', [
            'name' => 'Riley Example',
            'email' => 'riley@example.test',
            'subject' => 'A question about transfers',
            'message' => 'I would like to know when a scheduled transfer will appear.',
            'website' => '',
        ])
            ->assertCreated()
            ->assertExactJson(['message' => "Message received. We'll reply soon."]);

        $ticket = SupportTicket::query()->firstOrFail();
        $this->assertNull($ticket->user_id);
        $this->assertSame('Riley Example', $ticket->name);
        $this->assertSame('riley@example.test', $ticket->email);
        Mail::assertSent(ContactReceivedMail::class, function (ContactReceivedMail $mail) use ($ticket): bool {
            $rendered = $mail->render();

            return $mail->hasTo('riley@example.test')
                && $mail->ticketReference === 'WB-'.str_pad((string) $ticket->id, 8, '0', STR_PAD_LEFT)
                && str_contains($rendered, 'Westbridge National Bank')
                && str_contains($rendered, 'Demo only. Westbridge National Bank is not a real bank. No real money is held.');
        });
    }

    public function test_contact_validation_errors_include_all_invalid_fields(): void
    {
        $this->postJson('/api/v1/contact', [
            'name' => 'R',
            'email' => 'bad-email',
            'subject' => 'Hi',
            'message' => 'Short',
            'website' => '',
        ])
            ->assertUnprocessable()
            ->assertJsonStructure(['message', 'errors' => ['name', 'email', 'subject', 'message']]);
    }

    public function test_filled_contact_honeypot_returns_neutral_success_without_storing(): void
    {
        Mail::fake();

        $this->postJson('/api/v1/contact', [
            'name' => '',
            'email' => 'not-an-email',
            'subject' => '',
            'message' => '',
            'website' => 'automated submission',
        ])
            ->assertOk()
            ->assertExactJson(['message' => "Message received. We'll reply soon."]);

        $this->assertDatabaseCount('support_tickets', 0);
        Mail::assertNothingSent();
    }

    public function test_public_forms_are_throttled_after_five_requests_per_minute(): void
    {
        for ($attempt = 1; $attempt <= 5; $attempt++) {
            $this->postJson('/api/v1/newsletter', ['email' => "reader{$attempt}@example.test"])->assertOk();
        }

        $this->postJson('/api/v1/newsletter', ['email' => 'reader-six@example.test'])
            ->assertTooManyRequests()
            ->assertJsonPath('message', 'Too many requests.')
            ->assertHeader('Retry-After');
    }

    public function test_active_vite_origin_is_allowed_for_credentialed_api_requests(): void
    {
        $this->withHeaders([
            'Origin' => 'http://127.0.0.1:5173',
            'Access-Control-Request-Method' => 'POST',
        ])
            ->options('/api/v1/contact')
            ->assertNoContent()
            ->assertHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:5173')
            ->assertHeader('Access-Control-Allow-Credentials', 'true');
    }
}
