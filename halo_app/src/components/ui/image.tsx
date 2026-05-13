import type { ImageProps } from 'expo-image';
import { Image as NImage } from 'expo-image';
import { cssInterop } from 'nativewind';
import * as React from 'react';

export type ImgProps = ImageProps & {
  className?: string;
  fallbackAfterMs?: number;
};

cssInterop(NImage, { className: 'style' });

export const Image = ({
  style,
  className,
  placeholder = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4',
  fallbackAfterMs = 8000,
  ...props
}: ImgProps) => {
  const [hasError, setHasError] = React.useState(false);
  const [isTimedOut, setIsTimedOut] = React.useState(false);

  React.useEffect(() => {
    setHasError(false);
    setIsTimedOut(false);
    const timeoutId = setTimeout(() => setIsTimedOut(true), fallbackAfterMs);
    return () => clearTimeout(timeoutId);
  }, [props.source, fallbackAfterMs]);

  const source =
    hasError || isTimedOut ? require('../../../assets/icon.png') : props.source;

  return (
    <NImage
      className={className}
      placeholder={placeholder}
      style={style}
      {...props}
      source={source}
      onError={(e) => {
        setHasError(true);
        props.onError?.(e);
      }}
      onLoadEnd={(e) => {
        setIsTimedOut(false);
        props.onLoadEnd?.(e);
      }}
    />
  );
};

export const preloadImages = (sources: string[]) => {
  NImage.prefetch(sources);
};
