import { Component, OnInit } from '@angular/core';
import { AppShellComponent } from './components/app-shell/app-shell.component';
import { VaultService } from './services/vault.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AppShellComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  constructor(private readonly vault: VaultService) {}

  ngOnInit(): void {
    void this.vault.init();
  }
}
