import { OverlayRef } from '@angular/cdk/overlay';
import { GalleryDetailState } from './gallery-detail-state';
import { BehaviorSubject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { GalleryItem } from 'projects/gallery/src/lib/core/gallery-item';

export class GalleryDetailRef {
  private _state: BehaviorSubject<GalleryDetailState>;
  state: Observable<GalleryDetailState>;

  // TODO probably move to gallery detail componetn
  backdropClicks$: Observable<Event>;
  keydowns$: Observable<Event>;

  constructor(private overlayRef: OverlayRef) {
    this.backdropClicks$ = overlayRef.backdropClick();
    this.keydowns$ = this.overlayRef.keydownEvents();

    this._state = new BehaviorSubject<GalleryDetailState>({ items: [] });
    this.state = this._state.asObservable();
  }

  close() {
    this.overlayRef.dispose();
  }

  load(items: GalleryItem[]) {
    this._state.next({
      items
    });
  }
}
