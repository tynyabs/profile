const menuIcon = document.getElementById('menu-icon');
const navLinks = document.querySelector('.nav-links');

function setMenu(open) {
  navLinks.classList.toggle('active', open);
  menuIcon.classList.toggle('fa-bars', !open);
  menuIcon.classList.toggle('fa-xmark', open);
  menuIcon.setAttribute('aria-expanded', String(open));
}

menuIcon.addEventListener('click', () => {
  setMenu(!navLinks.classList.contains('active'));
});

navLinks.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => setMenu(false));
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('header')) setMenu(false);
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 900) setMenu(false);
});

//form
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form');
    if (!form) return;
    
    const submitBtn = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const object = Object.fromEntries(formData);
        const json = JSON.stringify(object);

        const originalText = submitBtn.textContent;
        submitBtn.textContent = "Sending...";
        submitBtn.disabled = true;

        try {
            const response = await fetch("https://api.web3forms.com/submit", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: json
            });

            const data = await response.json();

            if (response.status === 200) {
                alert("Success! Your message has been sent.");
                window.location.hash = "home";
                form.reset();
            } else {
                alert("Error: " + (data.message || "Something went wrong."));
            }

        } catch (error) {
            console.error(error);
            alert("Something went wrong. Please check your network connection.");
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
});