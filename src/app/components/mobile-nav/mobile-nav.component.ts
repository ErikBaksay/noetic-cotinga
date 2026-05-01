import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { VaultService } from '../../services/vault.service';

@Component({
  selector: 'app-mobile-nav',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mobile-nav.component.html',
  styleUrl: './mobile-nav.component.scss',
})
export class MobileNavComponent {
  constructor(public readonly vault: VaultService) {}
}
