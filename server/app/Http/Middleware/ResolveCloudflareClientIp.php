<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\IpUtils;
use Symfony\Component\HttpFoundation\Response;

class ResolveCloudflareClientIp
{
    public function handle(Request $request, Closure $next): Response
    {
        if ((bool) config('security.trust_cf_connecting_ip', false)) {
            $remoteAddress = (string) $request->server->get('REMOTE_ADDR', '');
            $trusted = config('security.trusted_proxies');
            $isTrustedProxy = $trusted === '*'
                || (is_array($trusted) && $trusted !== [] && IpUtils::checkIp($remoteAddress, $trusted));
            $cloudflareAddress = (string) $request->header('CF-Connecting-IP', '');
            if ($isTrustedProxy && filter_var($cloudflareAddress, FILTER_VALIDATE_IP) !== false) {
                $request->server->set('REMOTE_ADDR', $cloudflareAddress);
            }
        }

        return $next($request);
    }
}