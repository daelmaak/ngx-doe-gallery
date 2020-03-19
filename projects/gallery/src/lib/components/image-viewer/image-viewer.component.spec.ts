import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ImageViewerComponent } from './image-viewer.component';
import { ChevronIconComponent } from '../icons/chevron/chevron-icon.component';
import { ImageCounterComponent } from '../image-counter/image-counter.component';
import { SafePipe } from '../../pipes/safe.pipe';

describe('ImageViewerComponent', () => {
  let component: ImageViewerComponent;
  let fixture: ComponentFixture<ImageViewerComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [
        ImageViewerComponent,
        ChevronIconComponent,
        ImageCounterComponent,
        SafePipe
      ]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ImageViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
