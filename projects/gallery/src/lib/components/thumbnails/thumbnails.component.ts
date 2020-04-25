import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  TemplateRef,
  ViewChild,
  QueryList,
  ViewChildren
} from '@angular/core';
import { animationFrameScheduler, of, Subject } from 'rxjs';
import { map, repeat, switchMap, takeUntil, takeWhile } from 'rxjs/operators';

import { isBrowser, SUPPORT, Orientation } from '../../core';
import {
  GalleryItemInternal,
  GalleryItemEventInternal
} from '../../core/gallery-item';
import { Aria } from '../../core/aria';

@Component({
  selector: 'ngx-thumbnails',
  templateUrl: './thumbnails.component.html',
  styleUrls: ['./thumbnails.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ThumbnailsComponent
  implements OnChanges, AfterViewInit, OnDestroy {
  @Input()
  items: GalleryItemInternal[] = [];

  @Input()
  selectedIndex: number;

  @Input()
  aria: Aria;

  @Input()
  @HostBinding('class')
  orientation: Orientation;

  @Input()
  arrows: boolean;

  @Input()
  arrowSlideByLength: number;

  @Input()
  autoScroll: boolean;

  @Input()
  set scrollBehavior(val: ScrollBehavior) {
    this._scrollBehavior = val || 'smooth';
  }

  get scrollBehavior() {
    return this.smoothScrollAllowed ? this._scrollBehavior : 'auto';
  }

  @Input()
  thumbTemplate: TemplateRef<any>;

  @Input()
  thumbErrorTemplate: TemplateRef<any>;

  @Input()
  prevArrowTemplate: TemplateRef<void>;

  @Input()
  nextArrowTemplate: TemplateRef<void>;

  @Output()
  thumbClick = new EventEmitter<GalleryItemEventInternal>();

  @Output()
  thumbHover = new EventEmitter<GalleryItemEventInternal>();

  @ViewChild('thumbs', { static: true })
  thumbListRef: ElementRef<HTMLElement>;
  @ViewChildren('thumb')
  thumbsRef: QueryList<ElementRef<HTMLElement>>;

  showStartArrow = false;
  showEndArrow = false;
  vertical: boolean;

  private destroy$ = new Subject();
  private sliding$ = new Subject<number>();

  private arrowObserver: IntersectionObserver;
  private _scrollBehavior: ScrollBehavior;
  private smoothScrollAllowed = false;

  private get scrollKey(): string {
    return this.vertical ? 'scrollTop' : 'scrollLeft';
  }

  private get thumbContainerMainAxis(): number {
    return this.vertical
      ? this.elRef.nativeElement.offsetHeight
      : this.elRef.nativeElement.offsetWidth;
  }

  private get thumbListMainAxis(): number {
    return this.vertical
      ? this.thumbListRef.nativeElement.scrollHeight
      : this.thumbListRef.nativeElement.scrollWidth;
  }

  constructor(
    private cd: ChangeDetectorRef,
    private elRef: ElementRef<HTMLElement>
  ) {}

  ngOnChanges({ arrows, items, orientation }: SimpleChanges) {
    if (orientation && orientation.currentValue != null) {
      const newOrientation: Orientation = orientation.currentValue;
      this.vertical = newOrientation === 'left' || newOrientation === 'right';
    }
    if (arrows) {
      if (arrows.currentValue && this.items && this.items.length) {
        this.observeArrows();
      } else if (!arrows.currentValue) {
        this.showStartArrow = false;
        this.showEndArrow = false;
        this.unobserveArrows();
      }
    }

    if (items && items.currentValue) {
      const currItems = (items.currentValue || []) as GalleryItemInternal[];
      const prevItems = (items.previousValue || []) as GalleryItemInternal[];

      if (currItems.length === prevItems.length) {
        return;
      }

      if (this.arrows && currItems.length) {
        this.observeArrows();
      }
      if (!prevItems.length) {
        setTimeout(() => this.centerThumbIfNeeded(this.selectedIndex));
      }
    }
  }

  ngAfterViewInit() {
    if (this.arrows && isBrowser) {
      this.initImperativeScroll();
    }
    this.centerThumbIfNeeded(this.selectedIndex);
    this.smoothScrollAllowed = true;
  }

  ngOnDestroy() {
    this.destroy$.next(null);
    this.destroy$.complete();
  }

  slide(direction: number) {
    let delta: number;

    if (this.arrowSlideByLength) {
      delta = this.arrowSlideByLength;
    } else {
      // Note: Slide by the full height/width of the gallery
      // or by the overflow of the thumbnails - to prevent unnecessary requestAnimationFrame calls while trying to scroll
      // outside of the min/max scroll of the thumbnails
      delta = Math.min(
        this.thumbContainerMainAxis,
        this.thumbListMainAxis - this.thumbContainerMainAxis
      );
    }
    this.sliding$.next(delta * direction);
  }

  centerThumbIfNeeded(index: number) {
    if (!this.items || this.items.length <= 1) {
      return;
    }

    const itemEls = this.thumbListRef.nativeElement.querySelectorAll('li');
    const nextItemEl = itemEls.item(index);

    const { offsetLeft, offsetTop, offsetWidth, offsetHeight } = nextItemEl;

    const itemOffset = this.vertical ? offsetTop : offsetLeft;
    const itemMainAxis = this.vertical ? offsetHeight : offsetWidth;

    const thumbListScrollPortAxis = this.thumbContainerMainAxis;
    const thumbListScroll = this.thumbListRef.nativeElement[this.scrollKey];

    const nextScrollDelta =
      itemOffset +
      itemMainAxis / 2 -
      thumbListScrollPortAxis / 2 -
      thumbListScroll;

    if (
      thumbListScroll + thumbListScrollPortAxis < itemOffset + itemMainAxis ||
      thumbListScroll > itemOffset
    ) {
      this.sliding$.next(nextScrollDelta);
    }
  }

  select(index: number) {
    if (this.autoScroll) {
      this.centerThumbIfNeeded(index);
    }
  }

  onItemErrored(item: GalleryItemInternal) {
    item._thumbFailed = true;
  }

  emitEvent(
    index: number,
    event: Event,
    emitter: EventEmitter<GalleryItemEventInternal>
  ) {
    emitter.emit({
      index,
      event
    });
  }

  private initImperativeScroll() {
    this.sliding$
      .pipe(
        switchMap(totalScrollDelta => {
          if (SUPPORT.scrollBehavior || this.scrollBehavior === 'auto') {
            return of(totalScrollDelta);
          }
          const totalDistance = Math.abs(totalScrollDelta);
          const startTime = Date.now();
          const baseArrowSlideTime = 200;
          let totalTime =
            (Math.log10(totalDistance) - 1.1) * baseArrowSlideTime;

          if (totalTime < 0) {
            totalTime = baseArrowSlideTime;
          }

          let currentScroll = 0;

          // Emulating native scroll-behavior: smooth
          // NOTE: This stream requests animation frames in a periodical fashion so that it can update scroll position of thumbnails
          // before each paint. The scroll value is updated proportionally to the time elapsed since the animation's start.
          // The period of requested frames should match the display's refresh rate as recommended in W3C spec. Essentially, this stream
          // requests animation frames in the same way as recursive calls to requestAnimationFrame().
          return of(0, animationFrameScheduler).pipe(
            repeat(),
            map(_ => {
              const suggestedScroll = Math.ceil(
                ((Date.now() - startTime) / totalTime) * totalDistance
              );
              const frameScroll = Math.min(
                suggestedScroll - currentScroll,
                totalDistance - currentScroll
              );
              currentScroll = suggestedScroll;

              return Math.sign(totalScrollDelta) * frameScroll;
            }),
            takeWhile(_ => currentScroll < totalDistance, true)
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(frameScroll => {
        this.thumbListRef.nativeElement[this.scrollKey] += frameScroll;
      });
  }

  private onArrowsObserved: IntersectionObserverCallback = entries => {
    const entryEl1 = entries[0].target as HTMLElement;
    const firstThumbEntry =
      entryEl1 === this.thumbsRef.first.nativeElement ? entries[0] : entries[1];
    const lastThumbEntry =
      entryEl1 === this.thumbsRef.last.nativeElement ? entries[0] : entries[1];

    this.showStartArrow = lastThumbEntry && lastThumbEntry.isIntersecting;
    this.showEndArrow = firstThumbEntry && firstThumbEntry.isIntersecting;

    if (!this.showStartArrow && !this.showEndArrow) {
      this.showStartArrow = this.showEndArrow = true;
    }
    this.cd.detectChanges();
  };

  private observeArrows() {
    if (!this.arrowObserver) {
      this.arrowObserver = new IntersectionObserver(this.onArrowsObserved, {
        root: this.elRef.nativeElement,
        threshold: 0.9
      });
    } else {
      this.arrowObserver.disconnect();
    }
    setTimeout(() => {
      this.arrowObserver.observe(this.thumbsRef.first.nativeElement);
      this.arrowObserver.observe(this.thumbsRef.last.nativeElement);
    });
  }

  private unobserveArrows() {
    this.arrowObserver.disconnect();
  }
}
