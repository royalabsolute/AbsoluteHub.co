import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { McServerService } from '../../../theme/shared/service/mc-server.service';
import { CardComponent } from '../../../theme/shared/components/card/card.component';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-console',
    standalone: true,
    imports: [CommonModule, FormsModule, CardComponent],
    templateUrl: './console.component.html',
    styleUrls: ['./console.component.scss']
})
export class ConsoleComponent implements OnInit, OnDestroy, AfterViewChecked {
    @ViewChild('scrollMe') private myScrollContainer!: ElementRef;
    consoleOutput: string[] = [];
    command: string = '';
    serverStatus: string = 'offline';
    private consoleSubscription!: Subscription;
    private statusSubscription!: Subscription;

    constructor(private mcService: McServerService) { }

    ngOnInit() {
        this.mcService.joinConsole();
        this.consoleSubscription = this.mcService.getConsoleOutput().subscribe(data => {
            this.consoleOutput.push(data);
            if (this.consoleOutput.length > 200) {
                this.consoleOutput.shift();
            }
        });

        this.statusSubscription = this.mcService.getStatsUpdate().subscribe(data => {
            this.serverStatus = data.status || 'offline';
        });

        this.mcService.getStatus().subscribe(data => {
            this.serverStatus = data.status;
        });
    }

    ngAfterViewChecked() {
        this.scrollToBottom();
    }

    scrollToBottom(): void {
        try {
            this.myScrollContainer.nativeElement.scrollTop = this.myScrollContainer.nativeElement.scrollHeight;
        } catch (err) { }
    }

    ngOnDestroy() {
        if (this.consoleSubscription) this.consoleSubscription.unsubscribe();
        if (this.statusSubscription) this.statusSubscription.unsubscribe();
    }

    sendCommand() {
        if (this.command.trim()) {
            this.mcService.sendCommand(this.command);
            this.consoleOutput.push(`> ${this.command}`);
            this.command = '';
        }
    }

    startServer() {
        this.mcService.startServer().subscribe();
    }

    stopServer() {
        this.mcService.stopServer().subscribe();
    }

    restartServer() {
        this.mcService.restartServer().subscribe();
    }
}
