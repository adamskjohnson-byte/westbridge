<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class ContactReceivedMail extends Mailable
{
    use Queueable;

    public function __construct(public readonly string $ticketReference) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'We received your message');
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.contact-received',
            with: ['ticketReference' => $this->ticketReference],
        );
    }
}
