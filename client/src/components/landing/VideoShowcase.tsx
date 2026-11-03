import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Play, RotateCcw, VolumeX } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Container } from '@/components/layout/container'
import { Section } from '@/components/layout/section'
import { landingContent } from '@/content/landing'
import { useAutoplayVideo } from '@/hooks/use-autoplay-video'
import { cn } from '@/lib/utils'
import { useTranslatedContent } from '@/i18n/use-translated-content'

export function VideoShowcase() {
  const content = useTranslatedContent(landingContent.videoShowcase, 'landing', 'videoShowcase')
  const { t } = useTranslation('landing')
  const video = useAutoplayVideo()

  return (
    <Section className="py-14 sm:py-18" container={false} id="video-showcase" variant="white">
      <Container className="max-w-[816px] px-4 sm:px-5">
        <div className="mx-auto mb-7 max-w-2xl text-center sm:mb-9">
          <p className="text-sm font-bold uppercase text-primary">{content.eyebrow}</p>
          <h2 className="mt-2 type-h2">{content.heading}</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{content.description}</p>
        </div>

        <div className="relative aspect-video overflow-hidden rounded-2xl border border-border bg-muted shadow-[0_20px_55px_rgba(42,35,39,0.12)]" dir="ltr">
          <video
            ref={video.videoRef}
            className="size-full object-cover"
            src={content.src}
            playsInline
            preload="metadata"
            muted={video.isMuted}
            controls
            {...(content.poster ? { poster: content.poster } : {})}
            onPlay={video.handlePlay}
            onPause={video.handlePause}
            onVolumeChange={video.handleVolumeChange}
            onEnded={video.handleEnded}
          >
            {content.captionsSrc && (
              // TODO: Add and publish an English WebVTT captions file for the spoken video.
              <track kind="captions" src={content.captionsSrc} srcLang="en" label={content.captionsLabel} default />
            )}
          </video>

          {video.isMuted && (
            <Button
              aria-label={t('videoShowcase.unmute')}
              className="absolute end-3 top-3 z-10 rounded-full border border-white/60 bg-primary px-4 text-primary-foreground shadow-lg hover:bg-primary/90 sm:end-5 sm:top-5"
              onClick={video.toggleMute}
              type="button"
            >
              <VolumeX aria-hidden="true" />
              <span>{t('videoShowcase.tapToUnmute')}</span>
            </Button>
          )}

          {video.hasEnded ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-foreground/55 p-4 text-center">
              <Button className="rounded-full px-5" onClick={video.replay} type="button">
                <RotateCcw aria-hidden="true" />
                {t('videoShowcase.replay')}
              </Button>
              <Link className={cn(buttonVariants(), 'btn-gradient')} to="/register">
                {t('hero.primaryCta')}
              </Link>
            </div>
          ) : video.showPlayButton && (
            <Button
              aria-label={t('videoShowcase.play')}
              className="absolute start-1/2 top-1/2 z-10 size-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary text-primary-foreground shadow-xl hover:bg-primary/90 sm:size-20 [&_svg]:size-7"
              onClick={() => {
                video.play()
              }}
              size="icon"
              type="button"
            >
              <Play aria-hidden="true" fill="currentColor" />
            </Button>
          )}
        </div>
      </Container>
    </Section>
  )
}