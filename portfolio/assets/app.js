let group = $(".group");
let form = $("#command-form");
let prepend = $(".prepend");
let lastCommand = "";
let delay = 100;
let tempCount = 0;
let historyIndex = -1;  // Start with an invalid index

// Array to store previous commands
let commandHistory = [];

window.randomPhaseTrue = true;
import {startEffect} from "./passScript.js";

$("#browser-info").html(navigator.userAgent);

$(".icon").click(function () {
    tempCount++;
    if (!(tempCount % 5)) {
        toggleFullScreen();
    }
});


function bottom() {
    $(".window").animate({scrollTop: $(document).height()}, 1);
}

$("#help").click(function () {
    $(".commandline").val("help").focus();
});

// Array of valid commands
let search = [
    "ls", "about", "help", "hello", "hi", "merhaba", "references", "contact", "homepage",
    "open blog", "clear", "red", "green", "rainbow", "def", "delay 0", "delay 100",
    "delay 500", "delay def", "github", "exit", "fullscreen", "i dislike rainbows", "secret password", "very secret password"
];

$(document).keydown(function (e) {
    // When the user presses the up arrow (keyCode 38)
    if (e.keyCode == 38) {
        if (historyIndex < commandHistory.length - 1) {
            historyIndex++;  // Move to the next command in history
            $(".commandline").val(commandHistory[commandHistory.length - 1 - historyIndex]);

            // Move the cursor to the end of the input
            let input = $(".commandline")[0];
            input.setSelectionRange(input.value.length, input.value.length);
        }
    }

    // When the user presses the down arrow (keyCode 40)
    else if (e.keyCode == 40) {
        if (historyIndex > 0) {
            historyIndex--;  // Move to the previous command in history
            $(".commandline").val(commandHistory[commandHistory.length - 1 - historyIndex]);


        } else if (historyIndex === 0) {
            historyIndex--;  // Reset to no history (empty input)
            $(".commandline").val("");


        }
    }

    // When the user presses Enter (keyCode 13)
    else if (e.keyCode == 13) {
        let currentCommand = $(".commandline").val();
        if (currentCommand) {
            // Check if the current command is in the valid commands list
            if (search.includes(currentCommand.toLowerCase())) {
                if (commandHistory[commandHistory.length - 1] !== currentCommand) {
                    commandHistory.push(currentCommand);  // Store the valid command in history
                }

                historyIndex = -1;  // Reset the history index so the next up arrow starts at the latest command
            } else {
                $(".commandline").val("");  // Clear invalid input
                prepend.append("<br>>> Command not recognized.");
            }
        }
    }
});

// Form submission event
$(form).submit(function () {
    let input = $(".commandline").val().toLowerCase();
    lastCommand = input;
    if (input == "") {
        return;
    }

    let notfound = "<p>>> The command you entered is not recognized. To see all available commands you can type 'ls'.";
    let help = "<p>>> On this page, you can use the following commands <br>-about  -> Information About Me<br>-contact  -> contact me<br>-homepage  -> Other cool Page<br>-clear  -> Clears the Page<br>-secret -> a secret ☻<br>-guestbook -> simple guestbook<br>-Up Arrow Key   -> Retrieves the Previous Command You Entered<br>-exit   -> Closes the Tab</p>";
    let about = "<p>>> Hi, I'm fin, 18 years old with a passion for c# and learning. I have my own server room where this website is hosted—pretty cool, right? I love tinkering with computers; the first one I got my hands on was when I was 11.\nEver since then I have been exploring and learning as much as possible :) Thanks for visiting!</p>";
    let contact = "<br>>> My Email Address: <a href='mailto:admin@fishstix.uk'>admin@fishstix.uk</a> <br>please do msg me in discord if you have any suggestions or questions:<a href='https://discord.gg/BgCp6FMxTN'>fish_stix</a>";

    prepend.append("<br>-" + input + "..");
    form.trigger("reset");

    setTimeout(function () {
        const element = document.querySelector(".pass");

        switch (input.toLowerCase()) {
            case "ls":
                prepend.append(help);
                break;
            case "help":
                prepend.append(help);
                break;
            case "references":
                prepend.append(references);
                break;
            case "clear":
                prepend.html("");
                break;
            case "about":
                prepend.append(about);
                break;
            case "guestbook":
                prepend.append('<br>>> <a href="https://guestbook.fishstix.uk/" target="_blank">Click here to see the guestbook</a>');
                break;
            case "homepage":
                prepend.append('<br>>> <a>This is my only homepage for the time being.</a>');
                break;
            case "contact":
                prepend.append(contact);
                break;
            case "secret password":
                $(".window-inside").css("color", "transparent");
                $(".commandline").css("color", "transparent");
                $(".window-inside").addClass("rainbow");
                $(".commandline").addClass("rainbow");
                if (element) {
                    element.style.fontSize = "28px";
                }
                console.log("Secret Password was selected");
                startEffect(false);
                break;
            case "i dislike rainbows":
                $(".window-inside").css("color", "");
                $(".commandline").css("color", "");
                $(".window-inside").removeClass("rainbow");
                $(".commandline").removeClass("rainbow");
                if (element) {
                    element.style.fontSize = "28px";
                }
                console.log("password found was selected");
                startEffect(true);
                break;
            case "very secret password":
                $(".window-inside").css("color", "transparent");
                $(".commandline").css("color", "transparent");
                $(".window-inside").addClass("rainbow");
                $(".commandline").addClass("rainbow");
                console.log("very secret password selected");
                if (element) {
                    element.style.fontSize = "28px";
                }
                startEffect(false);
                break;
            case "delay 0":
                delay = 0;
                prepend.append("<br>>> Delay set to 100ms");
                break;
            case "exit":
                prepend.append("<br>>> Konsol kapatılıyor..");
                window.top.close();
                break;
            case "fullscreen":
                toggleFullScreen();
                break;
            case "secret":
                prepend.append("<br>>> To find the secret, just look around, I am sure you can find it :)");
                break;
            default:
                prepend.append(notfound);
                break;
        }
        bottom();
    }, delay);
});

$(function () {
    $("#draggable").draggable();
});

function toggleFullScreen() {
    if (!document.fullscreenElement &&
        !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) {
            document.documentElement.msRequestFullscreen();
        } else if (document.documentElement.mozRequestFullScreen) {
            document.documentElement.mozRequestFullScreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
            document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
}
