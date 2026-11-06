<x-mail::message>
# Verify your Westbridge sign-in

Your one-time security code is:

<x-mail::panel>{{ $code }}</x-mail::panel>

This code expires in {{ $expiresInMinutes }} minutes. Request IP: {{ $ipAddress }}.

If this wasn't you, change your password immediately.

Demo only. Westbridge National Bank is not a real bank. No real money is held.
</x-mail::message>