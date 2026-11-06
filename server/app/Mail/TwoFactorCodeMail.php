<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class TwoFactorCodeMail extends Mailable
{
    use Queueable;

    public function __construct(
        public readonly string $code,
        public readonly int $expiresInMinutes,
        public readonly string $ipAddress,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Your Westbridge sign-in verification code');
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.two-factor-code', with: [
            'code' => $this->code,
            'expiresInMinutes' => $this->expiresInMinutes,
            'ipAddress' => $this->ipAddress,
        ]);
    }
}