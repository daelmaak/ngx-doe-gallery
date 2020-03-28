import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  QueryList,
  SimpleChanges,
  TemplateRef,
  ViewChild,
  ViewChildren
} from '@angular/core';
import { fromEvent, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import {
  clientSide,
  ObjectFit,
  Loading,
  Orientation,
  UA,
  VerticalOrientation
} from '../../core';
import { GalleryItemInternal } from '../../core/gallery-item';
import { ItemTemplateContext } from '../../core/template-contexts';
import { ImageClickEvent } from './image-viewer.model';

@Component({
  selector: 'ngx-image-viewer',
  templateUrl: './image-viewer.component.html',
  styleUrls: ['./image-viewer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImageViewerComponent implements OnChanges, OnInit, OnDestroy {
  @Input()
  items: GalleryItemInternal[];

  @Input()
  arrows: boolean;

  @Input()
  prevArrowTemplate: TemplateRef<void>;

  @Input()
  nextArrowTemplate: TemplateRef<void>;

  @Input()
  selectedIndex: number;

  @Input()
  descriptions: boolean;

  @Input()
  imageCounter: boolean;

  @Input()
  imageCounterOrientation: VerticalOrientation;

  @Input()
  loading: Loading;

  @Input()
  loop: boolean;

  @Input()
  objectFit: ObjectFit;

  @Input()
  itemTemplate: TemplateRef<ItemTemplateContext>;

  @Input()
  loadingTemplate: TemplateRef<void>;

  @Input()
  galleryMainAxis: Orientation;

  @Output()
  imageClick = new EventEmitter<ImageClickEvent>();

  @Output()
  descriptionClick = new EventEmitter<Event>();

  @Output()
  selection = new EventEmitter<number>();

  @ViewChild('itemList', { static: true }) itemListRef: ElementRef<HTMLElement>;
  @ViewChildren('items') itemsRef: QueryList<ElementRef<HTMLElement>>;

  imagesHidden = true;
  noAnimation = false;

  private destroy$ = new Subject();

  private itemWidth: number;
  private listX = 0;

  get lazyLoading() {
    return this.loading === 'lazy';
  }

  get showArrow() {
    return this.arrows && this.items && this.items.length > 1;
  }

  get showPrevArrow() {
    return this.showArrow && (this.selectedIndex > 0 || this.loop);
  }

  get showNextArrow() {
    return (
      this.showArrow &&
      (this.selectedIndex < this.items.length - 1 || this.loop)
    );
  }

  constructor(
    private hostRef: ElementRef<HTMLElement>,
    private cd: ChangeDetectorRef,
    private zone: NgZone
  ) {}

  ngOnChanges({ galleryMainAxis, items }: SimpleChanges) {
    if (galleryMainAxis && !galleryMainAxis.firstChange) {
      // if image-viewer - thumbnails layout (main axis) changed from vertical to horizontal or vice versa
      if (!(galleryMainAxis.currentValue & galleryMainAxis.previousValue)) {
        requestAnimationFrame(() => {
          this.itemWidth = this.hostRef.nativeElement.offsetWidth;
          this.center();
        });
      }
    }
    // late initialization; in case the gallery items come later
    if (items && items.currentValue) {
      this.onResize();
      setTimeout(() => this.markAsVisitedIfNeeded(this.selectedIndex));
    }
  }

  ngOnInit() {
    this.imageCounter === undefined && (this.imageCounter = true);
    this.imageCounterOrientation == null &&
      (this.imageCounterOrientation = 'top');
    this.objectFit == null && (this.objectFit = 'contain');

    if (clientSide) {
      const opts = {
        passive: !UA.ios
      };

      fromEvent(window, 'resize', opts)
        .pipe(takeUntil(this.destroy$))
        .subscribe(this.onResize);

      this.zone.runOutsideAngular(() => {
        const imageList = this.itemListRef.nativeElement;

        let mousedown: MouseEvent;

        const onmousedown = (e: MouseEvent) => {
          mousedown = e;
          this.noAnimation = true;
          this.cd.detectChanges();

          document.addEventListener('mousemove', onmousemove, opts);
          document.addEventListener('mouseup', onmouseup, opts);
        };

        const onmousemove = (e: MouseEvent) => {
          this.shiftImagesByDelta(mousedown.x - e.x);
        };

        const onmouseup = (e: MouseEvent) => {
          this.noAnimation = false;

          const time = e.timeStamp - mousedown.timeStamp;
          const distance = mousedown.x - e.x;

          this.selectBySwipeStats(time, distance);

          document.removeEventListener('mousemove', onmousemove);
          document.removeEventListener('mouseup', onmouseup);
        };

        let horizontal = null;
        let touchstart: TouchEvent;
        let lastTouchmove: TouchEvent;

        const ontouchstart = (e: TouchEvent) => {
          touchstart = e;
          this.noAnimation = true;
          this.cd.detectChanges();
        };

        const ontouchmove = (e: TouchEvent) => {
          if (!touchstart || e.touches.length !== 1) {
            return;
          }
          const startTouch = touchstart.touches[0];
          const moveTouch = e.touches[0];

          if (horizontal == null) {
            const deltaX = Math.abs(moveTouch.clientX - startTouch.clientX);
            const deltaY = Math.abs(moveTouch.clientY - startTouch.clientY);

            if (deltaX || deltaY) {
              horizontal = deltaX * 1.2 >= deltaY;
            }
          }

          if (horizontal) {
            lastTouchmove = e;
            this.shiftImagesByDelta(startTouch.clientX - moveTouch.clientX);
            if (UA.ios) {
              e.preventDefault();
              e.stopPropagation();
            }
          }
        };

        const ontouchend = _ => {
          this.noAnimation = false;

          if (lastTouchmove) {
            const time = lastTouchmove.timeStamp - touchstart.timeStamp;
            const distance =
              touchstart.touches[0].clientX - lastTouchmove.touches[0].clientX;

            this.selectBySwipeStats(time, distance);
          }
          horizontal = null;
          touchstart = null;
          lastTouchmove = null;
        };

        imageList.addEventListener('mousedown', onmousedown, opts);
        imageList.addEventListener('touchstart', ontouchstart, opts);
        document.addEventListener('touchmove', ontouchmove, opts);
        document.addEventListener('touchend', ontouchend);

        this.destroy$.subscribe(() => {
          imageList.removeEventListener('mousedown', onmousedown);
          document.removeEventListener('mousemove', onmousemove);
          document.removeEventListener('mouseup', onmouseup);
          imageList.removeEventListener('touchstart', ontouchstart);
          document.removeEventListener('touchmove', ontouchmove);
          document.removeEventListener('touchend', ontouchend);
        });
      });
    }
  }

  ngOnDestroy() {
    this.destroy$.next(null);
    this.destroy$.complete();
  }

  getSrc(item: GalleryItemInternal) {
    return this.lazyLoading && !item._visited ? '' : item.src;
  }

  isYoutube(item: GalleryItemInternal) {
    return !!item.src.match(/youtube.*\/embed\//);
  }

  prev() {
    this.select(this.selectedIndex - 1);
  }

  next() {
    this.select(this.selectedIndex + 1);
  }

  select(index: number) {
    if (this.selectedIndex === index) {
      this.center();
      return;
    }

    if (!this.loop && (index < 0 || index >= this.items.length)) {
      this.center();
      return;
    }

    if (index < 0) {
      index = this.items.length - 1;
    } else if (index >= this.items.length) {
      index = 0;
    }

    // stop video when navigating away from it
    if (this.items[this.selectedIndex].video) {
      const videoEl: HTMLMediaElement = this.itemsRef
        .toArray()
        [this.selectedIndex].nativeElement.querySelector('video');

      if (videoEl) {
        videoEl.pause();
      }
    }

    this.markAsVisitedIfNeeded(index);

    this.selectedIndex = index;
    this.selection.emit(index);
    this.center();
  }

  onImageClick(item: GalleryItemInternal, event: Event) {
    this.imageClick.emit({
      event,
      item,
      index: this.items.indexOf(item)
    });
  }

  onItemLoaded(item: GalleryItemInternal, loadEvent: Event) {
    const target = loadEvent.target as HTMLElement;

    // elements with empty src also get loaded event, therefore the check
    if (target.getAttribute('src')) {
      item._loaded = true;
    }
  }

  private center() {
    const shift = this.selectedIndex * this.itemWidth;

    this.shiftImages(shift);
  }

  private markAsVisitedIfNeeded(index: number) {
    const item = this.items[index];
    if (!item._visited) {
      item._visited = true;
      this.cd.markForCheck();
    }
  }

  private onResize = () => {
    requestAnimationFrame(() => {
      if (!this.items || !this.items.length) {
        this.shiftImages(0);
      } else {
        this.itemWidth = this.hostRef.nativeElement.offsetWidth;
        this.center();
      }

      this.imagesHidden = false;
      this.cd.detectChanges();
    });
  };

  private selectBySwipeStats(time: number, distance: number) {
    if (Math.abs(time / distance) < 4 && Math.abs(distance) > 20) {
      this.select(this.selectedIndex + Math.sign(distance));
    } else {
      this.select(Math.round(this.listX / this.itemWidth));
    }
    this.cd.detectChanges();
  }

  private shiftImages(x: number) {
    const imageListEl = this.itemListRef.nativeElement;
    imageListEl.style.transform = `translate3d(${-(this.listX = x)}px, 0, 0)`;
  }

  private shiftImagesByDelta = (delta: number) => {
    this.shiftImages(this.selectedIndex * this.itemWidth + delta);
  };
}
