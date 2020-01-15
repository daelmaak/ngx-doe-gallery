import { TemplateRef } from '@angular/core';
import { Orientation, ImageFit } from 'projects/gallery/src/public-api';

export interface GalleryDetailConfig {
  // TODO should the overlay and gallery config be split?
  // overlay config
  hasBackdrop?: boolean;
  panelClass?: string | string[];
  documentScroll?: boolean;
  keyboardNavigation?: boolean;
  // gallery config
  arrows?: boolean;
  imageCounter?: boolean;
  imageFit?: ImageFit;
  imageTemplate?: TemplateRef<any>;
  loop?: boolean;
  thumbTemplate?: TemplateRef<any>;
  thumbsOrientation?: Orientation;
  thumbsScroll?: boolean;
  thumbsArrows?: boolean;
  thumbsArrowSlideTime?: number;
  thumbsArrowSlideByLength?: number;
}
