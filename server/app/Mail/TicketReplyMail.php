<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class TicketReplyMail extends Mailable
{
    use Queueable;

    public function __construct(
        public readonly string $ticketSubject,
        public readonly string $reply,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'A reply to your Westbridge support request');
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.ticket-reply', with: [
            'ticketSubject' => $this->ticketSubject,
            'reply' => $this->reply,
        ]);
    }
}
